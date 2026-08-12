import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type postgres from 'postgres';

import { SCHEMA_OWNER_ROLE } from './bootstrap.js';

// Resolves identically from src/ and from dist/, both of which sit one level under the
// package root alongside drizzle/.
export const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

/**
 * Applies pending migrations through drizzle-orm's migrator rather than `drizzle-kit
 * migrate`, so the deployed path needs no devDependency: drizzle-kit is a build-time tool
 * and is absent from a production install.
 *
 * DDL runs as SCHEMA_OWNER_ROLE, so every object is owned by the group rather than by
 * whichever identity happened to migrate; `bootstrapOwnerRole` must have run against this
 * database first. `SET ROLE` binds to one session and the migrator opens its own transaction
 * on the same client, so a pool of more than one is refused rather than silently migrating
 * part of the schema under the wrong owner. A reserved connection would say this better, but
 * drizzle's driver reads members postgres.js puts only on the pooled client.
 */
export async function migrateToLatest(sql: postgres.Sql): Promise<void> {
  if (sql.options.max !== 1) {
    throw new Error(
      `migrateToLatest needs a client with max: 1, got ${sql.options.max} — SET ROLE binds to a single session`,
    );
  }

  await sql`SET ROLE ${sql(SCHEMA_OWNER_ROLE)}`;
  try {
    await migrate(drizzle(sql), { migrationsFolder });
  } finally {
    await sql`RESET ROLE`;
  }
}
