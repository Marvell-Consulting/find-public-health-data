import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { appEnvFields, parseEnv, z } from '@fphd/config';
import type postgres from 'postgres';

import { createPostgresClient } from '../client.js';
import { dbEnvFields, resolveDbTls } from '../env.js';

const repoEnvFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

// Test-harness connections run as the database owner role, like drizzle-kit and the
// operations CLI. Values already present in the environment win over the repo .env
// file. `database` overrides POSTGRES_DB for maintenance and test targets.
export function createOwnerClient(database?: string): postgres.Sql {
  if (existsSync(repoEnvFile)) {
    process.loadEnvFile(repoEnvFile);
  }
  const env = parseEnv(
    z.object({
      ...dbEnvFields,
      ...appEnvFields,
      POSTGRES_USER: z.string().default('fphd'),
      POSTGRES_PASSWORD: z.string().default('fphd'),
    }),
    process.env,
  );
  return createPostgresClient(
    {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: database ?? env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
    },
    { max: 1, onnotice: () => {} },
  );
}
