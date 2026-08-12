import { appEnvFields, parseEnv, z } from '@fphd/config';
import type postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createPostgresClient } from './client.js';
import { dbEnvFields, resolveDbTls } from './env.js';
import { readAppliedMigrations, readLocalMigrations } from './migration-status.js';
import { migrateToLatest } from './migrations.js';
import { createOwnerClient } from './scripts/owner-client.js';
import { createTestDatabase, type TestDatabase } from './testing.js';

// Must match MIGRATION_LOCK_KEY in migrations.ts. If it drifts, the lock test stops blocking
// and fails, rather than passing while asserting nothing.
const MIGRATION_LOCK_KEY = 0x6d696772;

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

let testDb: TestDatabase;
let sql: postgres.Sql;
let pool: postgres.Sql | undefined;

// A database per test: two of these deliberately corrupt the migration bookkeeping, and a
// shared one would leave the rest asserting against wreckage.
beforeEach(async () => {
  testDb = await createTestDatabase();
  sql = createOwnerClient(testDb.name);

  return async () => {
    await sql.end();
    await testDb.drop();
  };
});

afterAll(async () => {
  await pool?.end();
});

function poolOf(size: number): postgres.Sql {
  pool = createPostgresClient(
    {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: testDb.name,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
    },
    { max: size, onnotice: () => {} },
  );
  return pool;
}

describe('migrateToLatest', () => {
  it('is a no-op against a database already at the latest migration', async () => {
    await migrateToLatest(sql);

    expect(await readAppliedMigrations(sql)).toHaveLength(readLocalMigrations().length);
  });

  it('refuses a client that could run its statements on more than one session', async () => {
    await expect(migrateToLatest(poolOf(2))).rejects.toThrow(/max: 1/);
  });

  it('refuses a migration edited since it was applied', async () => {
    await sql`
      UPDATE drizzle.__drizzle_migrations SET hash = 'edited-since-it-was-applied'
      WHERE created_at = (SELECT max(created_at) FROM drizzle.__drizzle_migrations)
    `;

    await expect(migrateToLatest(sql)).rejects.toThrow(/tampered/);
  });

  // Drizzle's migrator applies anything newer than the single newest recorded row, so an
  // unrecorded older migration is passed over on every run without an error. Dropping all but
  // the newest row reproduces that shape against the real migrations folder.
  it('refuses a migration that would be silently passed over', async () => {
    await sql`
      DELETE FROM drizzle.__drizzle_migrations
      WHERE created_at < (SELECT max(created_at) FROM drizzle.__drizzle_migrations)
    `;

    await expect(migrateToLatest(sql)).rejects.toThrow(/skipped/);
  });

  it('waits for a migration already in progress rather than racing it', async () => {
    const holder = createOwnerClient(testDb.name);
    await holder`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`;

    let settled = false;
    const migrating = migrateToLatest(sql).then(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(settled, 'migrated while another session held the lock').toBe(false);

    await holder`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    await migrating;
    await holder.end();

    expect(settled).toBe(true);
  });

  it('releases the lock, so a later run is not blocked by an earlier one', async () => {
    await migrateToLatest(sql);
    await migrateToLatest(sql);

    const held = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_locks
      WHERE locktype = 'advisory' AND objid = ${MIGRATION_LOCK_KEY}
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
    `;
    expect(held[0]?.count).toBe(0);
  });
});
