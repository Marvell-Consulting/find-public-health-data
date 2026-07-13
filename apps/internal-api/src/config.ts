import { logEnvFields, parseEnv, portSchema } from '@fphd/config';
import { dbEnvFields } from '@fphd/db';
import { z } from 'zod';

const envSchema = z.object({
  APP_ENV: z.enum(['local', 'dev', 'staging', 'production']).default('local'),
  PORT: portSchema.default(4001),
  ...logEnvFields,
  ...dbEnvFields,
  INTERNAL_API_PASSWORD: z.string().min(1),
});

/**
 * Build the app config from an environment. Every process.env read in this app happens here;
 * new config domains (auth, notifications, …) add a schema fragment above and a section below.
 */
export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = parseEnv(envSchema, env);

  return {
    appEnv: parsed.APP_ENV,
    port: parsed.PORT,
    log: {
      level: parsed.LOG_LEVEL,
      pretty: parsed.LOG_PRETTY,
    },
    db: {
      host: parsed.DB_HOST,
      port: parsed.DB_PORT,
      database: parsed.POSTGRES_DB,
      user: 'internal_api',
      password: parsed.INTERNAL_API_PASSWORD,
    },
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;

let loaded: Config | undefined;

/**
 * The app's config, parsed from process.env on first use. A function rather than a module-level
 * constant so importing this module (e.g. from tests) never reads the real environment.
 */
export function getConfig(): Config {
  loaded ??= loadConfig(process.env);
  return loaded;
}
