import { z } from 'zod';

/**
 * A TCP port parsed from env text. No default here — each consumer attaches its own via
 * `.default(n)` so the fallback lives next to the app that owns it.
 */
export const portSchema = z.coerce.number().int().min(1).max(65_535);

/**
 * A boolean parsed from env text. Only 'true'/'1' and 'false'/'0' are accepted — a plain
 * `z.coerce.boolean()` would turn the string 'false' into true, which is never what an env
 * var means.
 */
export const boolSchema = z.enum(['true', '1', 'false', '0']).transform((value) => {
  return value === 'true' || value === '1';
});

/** The deployment environments an app can run in. `local` is a developer machine. */
export const appEnvSchema = z.enum(['local', 'dev', 'preview', 'production']);

/**
 * The vars every server process shares — deployment environment and listen address. Defined
 * once so the names and accepted values can't drift between apps; only the port default is
 * per-app, so it is a parameter.
 */
export function serverEnvFields(defaults: { port: number }) {
  return {
    APP_ENV: appEnvSchema.default('local'),
    HOST: z.string().default('0.0.0.0'),
    PORT: portSchema.default(defaults.port),
  };
}

/**
 * Logging vars shared by every app schema. The level names mirror pino's, kept as a plain
 * enum so this package carries no pino dependency. LOG_PRETTY has no default here — apps
 * derive one from APP_ENV (pretty on locally, JSON everywhere else) when it is unset.
 */
export const logEnvFields = {
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: boolSchema.optional(),
};

/**
 * Validate an environment against a schema, returning the typed result.
 *
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
