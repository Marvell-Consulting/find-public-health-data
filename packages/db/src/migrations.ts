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
 * A plain `finally` would let a failing teardown replace the error that caused it — a dead
 * connection rejects RESET ROLE and the unlock too, and the job would log the teardown
 * instead of the migration that failed. The teardown error only propagates when the work
 * itself succeeded.
 */
export async function withTeardown<T>(
  run: () => Promise<T>,
  teardown: () => Promise<unknown>,
): Promise<T> {
  let result: T;
  try {
    result = await run();
  } catch (error) {
    await teardown().catch(() => {});
    throw error;
  }
  await teardown();
  return result;
}

/**
 * postgres.js reconnects a dropped connection transparently, and a fresh session has no SET
 * ROLE — anything the migrator ran after that point would be owned by the login, reported as
 * success, and discovered only by the next `db verify`. The migrator applies everything in
 * one transaction so the window is small, but the outcome is silent; this makes it loud.
 * Filters mirror what bootstrapOwnerRole reassigns, so the remediation can always clear it.
 */
async function assertMigratedOwnership(sql: postgres.Sql): Promise<void> {
  const misowned = await sql<{ name: string }[]>`
    SELECT 'schema ' || nspname AS name FROM pg_namespace
    WHERE nspowner = session_user::regrole
      AND nspname NOT LIKE 'pg\\_%'
      AND nspname <> 'information_schema'
    UNION ALL
    SELECT c.oid::regclass::text FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relowner = session_user::regrole
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
      AND n.nspname NOT LIKE 'pg\\_%'
      AND n.nspname <> 'information_schema'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype IN ('e', 'a', 'i')
      )
    ORDER BY 1
  `;
  if (misowned.length > 0) {
    throw new Error(
      `Migrations applied, but owned by the login rather than ${SCHEMA_OWNER_ROLE}: ` +
        `${misowned.map((row) => row.name).join(', ')} — run db bootstrap to reassign`,
    );
  }
}

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
  await withTeardown(
    async () => {
      assertMigratable(compareMigrations(readLocalMigrations(), await readAppliedMigrations(sql)));

      await sql`SET ROLE ${sql(SCHEMA_OWNER_ROLE)}`;
      await withTeardown(
        () => migrate(drizzle(sql), { migrationsFolder }),
        () => sql`RESET ROLE`,
      );
      await assertMigratedOwnership(sql);
    },
    () => sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`,
  );
}
