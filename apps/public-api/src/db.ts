import { createDb, parsePort } from '@fphd/db';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (see .env.example).`);
  }
  return value;
}

// Connects as the public_api role.
export const db = createDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: parsePort(process.env.DB_PORT, 5432),
  database: process.env.POSTGRES_DB ?? 'fphd',
  user: 'public_api',
  password: required('PUBLIC_API_PASSWORD'),
});
