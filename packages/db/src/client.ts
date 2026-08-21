import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type Schema = typeof schema;
// This package's public surface hands out raw handles — `createOwnerClient` returns one and
// `rebuildReadModels` takes one — so consumers need a name for the type without taking a
// dependency on `postgres` themselves. Exported from the package index for that reason; the
// modules in here import `postgres` directly and have no use for the alias.
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
  // The connection spreads last so `options` cannot reach a connection field. Nothing needs
  // to, and an options bag that could quietly turn `ssl` back off would undo the point of
  // routing every caller through here.
  return postgres({
    ...options,
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.user,
    password: connection.password,
    ssl: connection.ssl,
  });
}

/**
 * Create a Drizzle client for the given connection. Each API passes its own role, so it
 * connects as its own database user.
 */
export function createDb(connection: DbConnection): Database {
  return drizzle(createPostgresClient(connection), { schema, casing: 'snake_case' });
}

/** A Drizzle handle over an already-open client, for callers that own the connection. */
export function createDbFromClient(client: postgres.Sql): Database {
  return drizzle(client, { schema, casing: 'snake_case' });
}

/**
 * A Drizzle handle over an open transaction, so repository functions can run inside a
 * transaction the caller composes with other work. The cast is sound for queries — drizzle
 * executes them through `unsafe`, which a transaction carries — but two limits follow.
 * The handle's own `transaction()` would call `begin`, which a transaction lacks, so
 * callers must not start one. And drizzle's constructor writes transparent parsers into
 * `client.options`, which a transaction does not carry either — result parsing was fixed
 * by the parent client at connect time — so the throwaway object here satisfies the
 * constructor but columns drizzle expects raw (timestamps) arrive driver-parsed. Callers
 * must read only values both parse identically: uuids, integers, text.
 */
export function createDbFromTransaction(tx: postgres.TransactionSql): Database {
  const client = Object.assign(tx, { options: { parsers: {}, serializers: {} } });
  return drizzle(client as unknown as postgres.Sql, { schema, casing: 'snake_case' });
}
