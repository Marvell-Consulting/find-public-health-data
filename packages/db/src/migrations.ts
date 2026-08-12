import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type postgres from 'postgres';

import { SCHEMA_OWNER_ROLE } from './bootstrap.js';
import {
  assertMigratable,
  compareMigrations,
  migrationsFolder,
  readAppliedMigrations,
  readLocalMigrations,
} from './migration-status.js';

export { migrationsFolder };

// Distinct from the test harness's copy lock: these serialise different things and a shared
// key would have a migration wait on a database copy.
const MIGRATION_LOCK_KEY = 0x6d696772; // 'migr'

/**
 * Applies pending migrations through drizzle-orm's migrator rather than `drizzle-kit
 * migrate`, so the deployed path needs no devDependency: drizzle-kit is a build-time tool
 * and is absent from a production install.
 *
 * Three things wrap that call. The advisory lock, because the migrator reads its watermark
 * outside the transaction it then applies in, so two concurrent jobs both see the same
 * starting point and the second fails partway through. It blocks rather than failing fast —
 * the job that waits goes on to find nothing pending, which is the right outcome.
 *
 * The pre-flight, because the states it refuses are ones the migrator reports success on
 * having applied nothing at all.
 *
 * And the role, so every object is owned by SCHEMA_OWNER_ROLE rather than by whichever
 * identity happened to migrate; `bootstrapOwnerRole` must have run against this database
 * first. `SET ROLE` binds to one session and the migrator opens its own transaction on the
 * same client, so a pool of more than one is refused rather than silently migrating part of
 * the schema under the wrong owner. A reserved connection would say this better, but
 * drizzle's driver reads members postgres.js puts only on the pooled client.
 */
export async function migrateToLatest(sql: postgres.Sql): Promise<void> {
  if (sql.options.max !== 1) {
    throw new Error(
      `migrateToLatest needs a client with max: 1, got ${sql.options.max} — SET ROLE and the advisory lock both bind to a single session`,
    );
  }

  await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
  try {
    assertMigratable(compareMigrations(readLocalMigrations(), await readAppliedMigrations(sql)));

    await sql`SET ROLE ${sql(SCHEMA_OWNER_ROLE)}`;
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql`RESET ROLE`;
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
  }
}
