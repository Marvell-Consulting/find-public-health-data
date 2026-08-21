import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { appEnvFields, parseEnv, z } from '@fphd/config';
import type postgres from 'postgres';

import { createPostgresClient } from '../client.js';
import { dbEnvFields, resolveDbTls } from '../env.js';

const repoEnvFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

// The owner-role connection settings: the repo .env file, with values already present in
// the environment winning over it. Exported so tests that build CLI configs by hand point
// them at the same database their connections use.
export function loadOwnerEnv() {
  if (existsSync(repoEnvFile)) {
    process.loadEnvFile(repoEnvFile);
  }
  return parseEnv(
    z.object({
      ...dbEnvFields,
      ...appEnvFields,
      POSTGRES_USER: z.string().default('fphd'),
      POSTGRES_PASSWORD: z.string().default('fphd'),
    }),
    process.env,
  );
}

// Test-harness connections run as the database owner role, like drizzle-kit and the
// operations CLI. `database` overrides POSTGRES_DB for maintenance and test targets.
// `max: 1` because `db migrate` binds its advisory lock to a single session.
export function createOwnerClient(database?: string): postgres.Sql {
  const env = loadOwnerEnv();
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
