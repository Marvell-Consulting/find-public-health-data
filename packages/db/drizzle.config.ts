import { existsSync } from 'node:fs';

import { parseEnv } from '@fphd/config';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

import { dbEnvFields } from './src/env.js';

// Load the repo-root .env when running drizzle-kit from this package (cwd = packages/db).
// drizzle-kit runs migrations as the owner role.
if (existsSync('../../.env')) {
  process.loadEnvFile('../../.env');
}

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    ssl: false,
  },
});
