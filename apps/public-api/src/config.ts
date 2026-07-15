import { logEnvFields, parseEnv, portSchema, z } from '@fphd/config';
import { dbEnvFields } from '@fphd/db';

const envSchema = z.object({
  APP_ENV: z.enum(['local', 'dev', 'preview', 'production']).default('local'),
  HOST: z.string().default('0.0.0.0'),
  PORT: portSchema.default(4000),
  ...logEnvFields,
  ...dbEnvFields,
  PUBLIC_API_PASSWORD: z.string().min(1),
});

/**
 * Build the app config from an environment. Every process.env read in this app happens here;
 * new config domains (auth, notifications, …) add a schema fragment above and a section below.
 */
export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = parseEnv(envSchema, env);

  return {
    appEnv: parsed.APP_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    log: {
      level: parsed.LOG_LEVEL,
      // Pretty logs are a local-development nicety; unless LOG_PRETTY says otherwise,
      // every deployed environment gets JSON.
      pretty: parsed.LOG_PRETTY ?? parsed.APP_ENV === 'local',
    },
    db: {
      host: parsed.DB_HOST,
      port: parsed.DB_PORT,
      database: parsed.POSTGRES_DB,
      user: 'public_api',
      password: parsed.PUBLIC_API_PASSWORD,
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
