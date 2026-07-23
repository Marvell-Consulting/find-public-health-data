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

/** `local` is a developer machine; the rest are deployed environments. */
export const appEnvSchema = z.enum(['local', 'dev', 'preview', 'production']);

/**
 * One definition so the var names and accepted values can't drift between apps; only the
 * port default is per-app, hence the parameter.
 */
export function serverEnvFields(defaults: { port: number }) {
  return {
    APP_ENV: appEnvSchema.default('local'),
    HOST: z.string().default('0.0.0.0'),
    PORT: portSchema.default(defaults.port),
  };
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

export function loadWebServerConfig(env: NodeJS.ProcessEnv, defaults: { port: number }) {
  const parsed = parseEnv(
    z.object({
      ...serverEnvFields(defaults),
      ...logEnvFields,
      NODE_ENV: nodeEnvSchema,
      SESSION_JWT_SECRET: z.string().min(32),
    }),
    env,
  );

  return {
    development: parsed.NODE_ENV === 'development',
    host: parsed.HOST,
    port: parsed.PORT,
    log: {
      level: parsed.LOG_LEVEL,
      pretty: parsed.APP_ENV === 'local' && (parsed.LOG_PRETTY ?? true),
    },
    session: {
      secret: parsed.SESSION_JWT_SECRET,
      secure: parsed.NODE_ENV === 'production',
    },
  } as const;
}
