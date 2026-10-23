import { type SQL, sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

// Surrogate keys default to time-ordered UUIDv7 (native in PostgreSQL 18) so rows
// can also be created with externally assigned ids, as import pipelines do.
export const uuidPrimaryKey = () => uuid().primaryKey().default(sql`uuidv7()`);

/** The app's own vocabulary as a list of SQL literals, for a check constraint. */
export function literals(values: readonly string[]): SQL {
  return sql.raw(values.map((value) => `'${value}'`).join(', '));
}

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};
