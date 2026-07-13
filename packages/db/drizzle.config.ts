import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

import { parsePort } from './src/env.js';

// Load the repo-root .env when running drizzle-kit from this package (cwd = packages/db).
// drizzle-kit runs migrations as the owner role.
if (existsSync('../../.env')) {
  process.loadEnvFile('../../.env');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parsePort(process.env.DB_PORT, 5432),
    user: process.env.POSTGRES_USER ?? 'fphd',
    password: process.env.POSTGRES_PASSWORD ?? 'fphd',
    database: process.env.POSTGRES_DB ?? 'fphd',
    ssl: false,
  },
});
