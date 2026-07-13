import { createDb, parsePort, requireEnv } from '@fphd/db';

// Connects as the internal_api role.
export const db = createDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: parsePort(process.env.DB_PORT, 5432),
  database: process.env.POSTGRES_DB ?? 'fphd',
  user: 'internal_api',
  password: requireEnv('INTERNAL_API_PASSWORD'),
});
