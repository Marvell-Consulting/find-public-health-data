import { logEnvFields, parseEnv, serverEnvFields, z } from '@fphd/config';

const envSchema = z.object({
  ...serverEnvFields({ port: 3001 }),
  ...logEnvFields,
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
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
    development: parsed.NODE_ENV === 'development',
    host: parsed.HOST,
    port: parsed.PORT,
    log: {
      level: parsed.LOG_LEVEL,
      pretty: parsed.APP_ENV === 'local' && (parsed.LOG_PRETTY ?? true),
    },
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;
