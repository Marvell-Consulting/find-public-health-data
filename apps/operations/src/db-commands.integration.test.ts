import { createOwnerClient, loadOwnerEnv, type SqlClient } from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { createLogger } from '@fphd/logger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolveCommand } from './commands.js';
import { importCoreData, reset, seedDummyData } from './db-commands.js';
import { type Config, loadConfig } from './load-config.js';

// The same settings the createOwnerClient connections below use, so the configs built
// here point at the same database.
const env = loadOwnerEnv();

// Through loadConfig rather than hand-built, so these contexts cannot drift from the shape
// the real CLI passes. DB_TLS off explicitly: the deployed-env cases here still point at
// the local test database, which presents no certificate.
function testConfig(database: string, appEnv: string): Config {
  return loadConfig({
    APP_ENV: appEnv,
    DB_HOST: env.DB_HOST,
    DB_PORT: String(env.DB_PORT),
    DB_TLS: 'false',
    POSTGRES_DB: database,
    POSTGRES_USER: env.POSTGRES_USER,
    POSTGRES_PASSWORD: env.POSTGRES_PASSWORD,
  });
}

const logger = createLogger({ name: 'operations-test', level: 'silent' });

function testContext(sql: SqlClient, database: string, appEnv: string) {
  return { sql, config: testConfig(database, appEnv), logger };
}

let emptyDb: TestDatabase;
let emptySql: SqlClient;

beforeAll(async () => {
  emptyDb = await createTestDatabase();
  emptySql = createOwnerClient(emptyDb.name);
});

afterAll(async () => {
  await emptySql.end();
  await emptyDb.drop();
});

async function count(sql: SqlClient, table: string): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM ${sql(table)}
  `;
  return row?.count ?? 0;
}

describe('db import-core-data (integration)', () => {
  it('loads topics, is idempotent on a re-run, and runs in any environment', async () => {
    // 'production' deliberately: core data is required content, so the command must not
    // carry the dummy seed's environment gate.
    const context = testContext(emptySql, emptyDb.name, 'production');

    await importCoreData(context);
    const topics = await count(emptySql, 'topic');
    expect(topics).toBeGreaterThan(0);
    const before = await emptySql`SELECT id, updated_at::text AS updated_at FROM topic ORDER BY id`;

    await importCoreData(context);
    const after = await emptySql`SELECT id, updated_at::text AS updated_at FROM topic ORDER BY id`;
    expect([...after]).toEqual([...before]);
  });
});

describe('db seed-dummy-data (integration)', () => {
  it('refuses outside dev-class environments before touching anything', async () => {
    await expect(seedDummyData(testContext(emptySql, emptyDb.name, 'production'))).rejects.toThrow(
      /Refusing to seed/,
    );
  });

  it('points at db migrate when the database is unmigrated', async () => {
    const unmigrated = await createTestDatabase({ template: 'unmigrated' });
    const sql = createOwnerClient(unmigrated.name);
    try {
      await expect(seedDummyData(testContext(sql, unmigrated.name, 'test'))).rejects.toThrow(
        /db migrate/,
      );
    } finally {
      await sql.end();
      await unmigrated.drop();
    }
  });

  // Explicit timeout: the template copy in the body queues behind the copy lock, like the
  // beforeAll copies the raised hookTimeout covers.
  it('refuses when core data has not been imported', async () => {
    const bare = await createTestDatabase();
    const sql = createOwnerClient(bare.name);
    try {
      await expect(seedDummyData(testContext(sql, bare.name, 'test'))).rejects.toThrow(
        /import-core-data/,
      );
    } finally {
      await sql.end();
      await bare.drop();
    }
  }, 60_000);
});

describe('db reset (integration)', () => {
  it('refuses outside dev-class environments', async () => {
    await expect(reset(testContext(emptySql, emptyDb.name, 'production'))).rejects.toThrow(
      /Refusing to reset/,
    );
  });

  it('reset → migrate → import-core-data → seed-dummy-data rebuilds a working database', async () => {
    const seeded = await createTestDatabase({ template: 'seeded' });
    const sql = createOwnerClient(seeded.name);
    try {
      const context = testContext(sql, seeded.name, 'test');

      // Stand-ins for anything a future migration might create, of object kinds the old
      // per-kind sweep did not know: recreating the schema removes them by construction.
      await sql`CREATE FUNCTION reset_probe() RETURNS int LANGUAGE sql AS 'SELECT 1'`;
      await sql`CREATE AGGREGATE reset_probe_agg(int) (SFUNC = int4pl, STYPE = int)`;
      await sql`CREATE TYPE reset_probe_range AS RANGE (subtype = int4)`;

      await reset(context);
      expect(await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`).toHaveLength(
        0,
      );
      expect(await sql`SELECT 1 FROM pg_proc WHERE proname LIKE 'reset_probe%'`).toHaveLength(0);
      expect(await sql`SELECT 1 FROM pg_type WHERE typname LIKE 'reset_probe%'`).toHaveLength(0);
      const [drizzleSchema] = await sql<{ present: boolean }[]>`
          SELECT to_regnamespace('drizzle') IS NOT NULL AS present
        `;
      expect(drizzleSchema?.present).toBe(false);

      // The recreated public schema must match a freshly created database's: owned by
      // pg_database_owner, USAGE granted to PUBLIC (grantee 0) — the APIs connect through
      // that default, and nothing later in the rebuild would restore it.
      const [publicSchema] = await sql<{ owner: string; public_usage: boolean }[]>`
          SELECT
            pg_get_userbyid(nspowner) AS owner,
            EXISTS (
              SELECT 1 FROM aclexplode(nspacl) a
              WHERE a.grantee = 0 AND a.privilege_type = 'USAGE'
            ) AS public_usage
          FROM pg_namespace
          WHERE nspname = 'public'
        `;
      expect(publicSchema?.owner).toBe('pg_database_owner');
      expect(publicSchema?.public_usage).toBe(true);

      await resolveCommand(['db', 'migrate']).run(context);
      await importCoreData(context);
      await seedDummyData(context);

      expect(await count(sql, 'topic')).toBeGreaterThan(0);
      expect(await count(sql, 'indicator')).toBeGreaterThan(0);
      expect(await count(sql, 'indicator_topic')).toBeGreaterThan(0);
      expect(await count(sql, 'latest_headline')).toBeGreaterThan(0);
    } finally {
      await sql.end();
      await seeded.drop();
    }
  }, 180_000);
});
