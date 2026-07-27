import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseEnv, z } from '@fphd/config';
import postgres from 'postgres';

import { dbEnvFields } from '../env.js';

const repoEnvFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

// Seed, rebuild and test-harness connections run as the database owner role, like
// drizzle-kit migrations. Values already present in the environment win over the
// repo .env file. `database` overrides POSTGRES_DB for maintenance and test targets.
export function createOwnerClient(database?: string): postgres.Sql {
  if (existsSync(repoEnvFile)) {
    process.loadEnvFile(repoEnvFile);
  }
  const env = parseEnv(
    z.object({
      ...dbEnvFields,
      POSTGRES_USER: z.string().default('fphd'),
      POSTGRES_PASSWORD: z.string().default('fphd'),
    }),
    process.env,
  );
  return postgres({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: database ?? env.POSTGRES_DB,
    username: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    max: 1,
    onnotice: () => {},
  });
}
