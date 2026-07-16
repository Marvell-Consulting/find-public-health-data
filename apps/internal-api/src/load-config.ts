import { logEnvFields, parseEnv, serverEnvFields, z } from '@fphd/config';
import { dbEnvFields } from '@fphd/db';

const envSchema = z.object({
  ...serverEnvFields({ port: 4001 }),
  ...logEnvFields,
  ...dbEnvFields,
  INTERNAL_API_PASSWORD: z.string().min(1),
});

/**
 * Every process.env read in this app happens via this module; new config domains (auth,
 * notifications, …) add a schema fragment above and a section below. Kept pure — the parse
 * of the real environment happens once, in config.ts.
 */
export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = parseEnv(envSchema, env);

  return {
    appEnv: parsed.APP_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    log: {
      level: parsed.LOG_LEVEL,
      pretty: parsed.APP_ENV === 'local' && (parsed.LOG_PRETTY ?? true),
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
