import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

export type Schema = typeof schema;
export type Database = PostgresJsDatabase<Schema>;

export interface DbConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/**
 * Create a Drizzle client for the given connection. Each API passes its own role, so it
 * connects as its own database user.
 */
export function createDb(connection: DbConnection): Database {
  const client = postgres({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.user,
    password: connection.password,
  });
  return drizzle(client, { schema, casing: 'snake_case' });
}
