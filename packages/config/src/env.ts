import { z } from 'zod';

/**
 * No default here — each schema attaches its own via `.default(n)` so the fallback lives
 * next to the app that owns it.
 */
export const portSchema = z.coerce.number().int().min(1).max(65_535);

/**
 * Not `z.coerce.boolean()`, which would turn the string 'false' into true — never what an
 * env var means.
 */
export const boolSchema = z.enum(['true', '1', 'false', '0']).transform((value) => {
  return value === 'true' || value === '1';
});

/**
 * `local` is a developer machine and `test` a test run or CI job; both mean everything
 * involved is on this machine, reached over http, with no certificate anywhere in the
 * picture. The rest are deployed.
 */
export const appEnvSchema = z.enum(['local', 'test', 'dev', 'preview', 'production']);

export type AppEnv = z.infer<typeof appEnvSchema>;

/**
 * The one predicate behind every fallback that differs between a machine here and a
 * deployed service — database TLS and secure session cookies today. Kept as a function
 * rather than repeated `!== 'local'` checks so adding an environment cannot leave one of
 * them behind.
 */
export function isDeployedEnv(appEnv: AppEnv): boolean {
  return appEnv !== 'local' && appEnv !== 'test';
}

/**
 * No default, deliberately. Every fallback keyed off APP_ENV is safe when deployed and
 * relaxed when not, so a default would have to be `local` — and an unset variable would
 * then silently pick the one value that turns TLS and secure cookies off. Every runtime
 * sets it: `.env.example` for development, compose for the containers, the test scripts
 * and CI for test runs, and the platform for deployed services.
 */
export const appEnvFields = { APP_ENV: appEnvSchema };

/**
 * One definition so the var names and accepted values can't drift between apps; only the
 * port default is per-app, hence the parameter.
 */
export function serverEnvFields(defaults: { port: number }) {
  return {
    ...appEnvFields,
    HOST: z.string().default('0.0.0.0'),
    PORT: portSchema.default(defaults.port),
    SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).optional(),
    // Unlike the drain, this carries a default here: it is a ceiling rather than a wait, so a
    // stop with nothing in flight is instant under it and a developer machine needs no
    // different value. The floor is what a stop needs to have phases at all.
    SHUTDOWN_GRACE_PERIOD_MS: z.coerce.number().int().min(1_000).default(25_000),
  };
}

/**
 * The two shutdown numbers together, so the one thing they must satisfy is checked once. The
 * drain has no default in the field above because this fallback depends on APP_ENV, which a
 * shared fragment cannot see: nothing routes to a machine here, so a delay would only make
 * Ctrl-C slow. The deployed value is two readiness probe intervals plus a margin.
 *
 * The drain comes out of the grace period rather than adding to it, so one that fills the
 * budget leaves nothing to finish in-flight work in — a misconfiguration worth a startup
 * failure rather than a stop that resets every live request.
 */
export function resolveShutdown(
  appEnv: AppEnv,
  env: { SHUTDOWN_DRAIN_MS?: number | undefined; SHUTDOWN_GRACE_PERIOD_MS: number },
) {
  const drainDelayMs = env.SHUTDOWN_DRAIN_MS ?? (isDeployedEnv(appEnv) ? 5_000 : 0);
  const gracePeriodMs = env.SHUTDOWN_GRACE_PERIOD_MS;

  if (drainDelayMs >= gracePeriodMs) {
    throw new Error(
      `Invalid environment configuration:\nSHUTDOWN_DRAIN_MS (${drainDelayMs}) must be under ` +
        `SHUTDOWN_GRACE_PERIOD_MS (${gracePeriodMs}), the budget for the whole stop\n` +
        '(see .env.example)',
    );
  }

  return { drainDelayMs, gracePeriodMs } as const;
}

/**
 * The level names mirror pino's, kept as a plain enum so this package carries no pino
 * dependency. LOG_PRETTY has no default here — apps derive one from APP_ENV when it is
 * unset.
 */
export const logEnvFields = {
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: boolSchema.optional(),
};

const nodeEnvSchema = z.enum(['development', 'production', 'test']).default('production');

/**
 * Blank values are dropped before parsing so `PORT=` behaves the same as an unset PORT —
 * zod defaults only apply to `undefined`, and an empty string would otherwise coerce to 0
 * or fail a `min(1)` check with a confusing message.
 *
 * On failure, throws a single error listing every invalid or missing variable, so a
 * misconfigured deployment reports all its problems in one startup crash.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined>,
): z.output<T> {
  const populated = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );

  const result = schema.safeParse(populated);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}\n(see .env.example)`,
    );
  }

  return result.data;
}

/**
 * Trailing slash stripped so callers can always build request URLs as
 * `${apiUrl}/api/...` without risking a doubled slash.
 */
const apiUrlSchema = z.url().transform((value) => value.replace(/\/+$/, ''));

export function loadWebServerConfig(
  env: NodeJS.ProcessEnv,
  defaults: { apiUrl: string; port: number },
) {
  const parsed = parseEnv(
    z.object({
      ...serverEnvFields(defaults),
      ...logEnvFields,
      API_URL: apiUrlSchema.default(defaults.apiUrl),
      NODE_ENV: nodeEnvSchema,
      SESSION_JWT_SECRET: z.string().min(32),
      // Signs the web app's own cookie session; rotates independently of the JWT secret.
      WEB_SESSION_SECRET: z.string().min(32),
    }),
    env,
  );

  return {
    development: parsed.NODE_ENV === 'development',
    host: parsed.HOST,
    port: parsed.PORT,
    apiUrl: parsed.API_URL,
    shutdown: resolveShutdown(parsed.APP_ENV, parsed),
    log: {
      level: parsed.LOG_LEVEL,
      pretty: parsed.APP_ENV === 'local' && (parsed.LOG_PRETTY ?? true),
    },
    session: {
      secret: parsed.SESSION_JWT_SECRET,
      secure: isDeployedEnv(parsed.APP_ENV),
    },
    webSession: {
      secret: parsed.WEB_SESSION_SECRET,
      secure: isDeployedEnv(parsed.APP_ENV),
    },
  } as const;
}
