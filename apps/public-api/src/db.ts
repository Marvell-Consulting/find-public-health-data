import { createDb, parsePort, requireEnv } from '@fphd/db';

// Connects as the public_api role.
export const db = createDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: parsePort(process.env.DB_PORT, 5432),
  database: process.env.POSTGRES_DB ?? 'fphd',
  user: 'public_api',
  password: requireEnv('PUBLIC_API_PASSWORD'),
});
