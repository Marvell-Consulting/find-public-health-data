import { createDb } from '@fphd/db';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (see .env.example).`);
  }
  return value;
}

// Connects as the internal_api role.
export const db = createDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? '5432'),
  database: process.env.POSTGRES_DB ?? 'fphd',
  user: 'internal_api',
  password: required('INTERNAL_API_PASSWORD'),
});
