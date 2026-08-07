import { appEnvFields, logEnvFields, parseEnv, z } from '@fphd/config';
import { dbEnvFields, resolveDbSsl } from '@fphd/db';

const envSchema = z.object({
  ...appEnvFields,
  ...logEnvFields,
  ...dbEnvFields,
  // The owner role, not one of the per-API roles: every command here either creates those
  // roles, alters the schema they are granted on, or writes data they may only read.
  POSTGRES_USER: z.string().default('fphd'),
  POSTGRES_PASSWORD: z.string().min(1),
  // Only `db bootstrap` needs these, and it is one command of several. Required here they
  // would stop `db migrate` running in a job that has no business holding role passwords,
  // so the command that uses them asserts them instead.
  PUBLIC_API_PASSWORD: z.string().min(1).optional(),
  INTERNAL_API_PASSWORD: z.string().min(1).optional(),
});

/**
 * Every process.env read in this app happens via this module. Kept pure — the parse of the
 * real environment happens once, in config.ts.
 *
 * No HOST or PORT: this app is a set of jobs run to completion, never a listening server.
 */
export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = parseEnv(envSchema, env);

  return {
    appEnv: parsed.APP_ENV,
    log: {
      level: parsed.LOG_LEVEL,
      pretty: parsed.APP_ENV === 'local' && (parsed.LOG_PRETTY ?? true),
    },
    db: {
      host: parsed.DB_HOST,
      port: parsed.DB_PORT,
      database: parsed.POSTGRES_DB,
      user: parsed.POSTGRES_USER,
      password: parsed.POSTGRES_PASSWORD,
      ssl: resolveDbSsl(parsed.APP_ENV, parsed.DB_SSL),
    },
    roles: {
      publicApiPassword: parsed.PUBLIC_API_PASSWORD,
      internalApiPassword: parsed.INTERNAL_API_PASSWORD,
    },
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;
