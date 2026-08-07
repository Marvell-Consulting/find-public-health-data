import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type Schema = typeof schema;
// Named here so callers that hold a raw handle — the operations CLI, the seed and read-model
// routines — can type it without depending on `postgres` themselves.
export type SqlClient = postgres.Sql;
// $client is exposed so short-lived callers (e.g. the topics import CLI) can end the
// connection explicitly instead of leaving the process to hang on an open socket.
export type Database = PostgresJsDatabase<Schema> & { $client: postgres.Sql };

export interface DbConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

/**
 * `ssl` is passed as a boolean, never the string 'require': postgres.js maps 'require' to
 * `rejectUnauthorized: false`, which encrypts the connection but authenticates nothing, so
 * it would accept any certificate presented. `true` verifies the chain against Node's
 * bundled CA store, which already holds the roots Azure's Postgres certificates chain to —
 * so no CA bundle has to be shipped in the image.
 */
export function createPostgresClient(
  connection: DbConnection,
  options: postgres.Options<Record<string, never>> = {},
): postgres.Sql {
  return postgres({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.user,
    password: connection.password,
    ssl: connection.ssl,
    ...options,
  });
}

/**
 * Create a Drizzle client for the given connection. Each API passes its own role, so it
 * connects as its own database user.
 */
export function createDb(connection: DbConnection): Database {
  return drizzle(createPostgresClient(connection), { schema, casing: 'snake_case' });
}
