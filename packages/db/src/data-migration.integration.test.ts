import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { importCoreData } from './core-data.ts';
import {
  INDICATOR_ID,
  type MigrationFixtureOptions,
  migrationFixture,
  SOURCE_ID,
  VERSION_COLUMNS,
  VERSION_ID,
  VERSION_ROW,
} from './data-migration.testing.ts';
import { applyDataMigration } from './data-migration.ts';
import {
  DATA_MIGRATION_REFERENCE_TABLES,
  DATA_MIGRATION_TABLES,
} from './data-migration-manifest.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

let database: TestDatabase;
let sql: postgres.Sql;
let directory: string;
let topicId: string;
let frameworkId: string;
let riskFactorId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  const core = createOwnerClient(database.name);
  try {
    await importCoreData(core);
  } finally {
    await core.end();
  }
  sql = createOwnerClient(database.name);
  const [topic] = await sql<{ id: string }[]>`SELECT id FROM topic LIMIT 1`;
  const [framework] = await sql<
    { id: string }[]
  >`SELECT id FROM classification WHERE dimension = 'framework' LIMIT 1`;
  const [riskFactor] = await sql<
    { id: string }[]
  >`SELECT id FROM classification WHERE dimension = 'risk_factor' LIMIT 1`;
  if (!topic || !framework || !riskFactor) throw new Error('Missing core fixture data');
  topicId = topic.id;
  frameworkId = framework.id;
  riskFactorId = riskFactor.id;
});
beforeEach(async () => {
  const tables = DATA_MIGRATION_TABLES.filter(
    (table) => !DATA_MIGRATION_REFERENCE_TABLES.includes(table),
  );
  await sql.unsafe(
    `TRUNCATE ${tables.map((table) => `"${table}"`).join(', ')}, data_migration CASCADE`,
  );
  await sql`ALTER SEQUENCE indicator_short_id_seq RESTART WITH 100000`;
  directory = await mkdtemp(join(tmpdir(), 'fphd-data-migration-test-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true });
});
afterAll(async () => {
  await sql.end();
  await database.drop();
});

async function apply(options: MigrationFixtureOptions = {}) {
  const { manifest, sha256 } = await migrationFixture(sql, directory, topicId, options);
  return sql.begin((tx) => applyDataMigration(tx, directory, manifest, sha256));
}
async function baseline(options: MigrationFixtureOptions = {}) {
  return apply({ baseline: true, ...options });
}
function version(sources: [string | null, string | null] = [null, null]) {
  return { columns: VERSION_COLUMNS, rows: [[...VERSION_ROW.slice(0, -2), ...sources]] };
}
async function sourceCount() {
  const [row] = await sql<
    { count: number }[]
  >`SELECT count(*)::int AS count FROM indicator_version_source WHERE indicator_version_id = ${VERSION_ID}`;
  return row?.count;
}
async function assertRolledBack() {
  const [row] = await sql<{ name: string; migrations: number; topics: number }[]>`
    SELECT v.name, (SELECT count(*)::int FROM data_migration) AS migrations,
      (SELECT count(*)::int FROM indicator_version_topic WHERE indicator_version_id = v.id) AS topics
    FROM indicator_version v WHERE id = ${VERSION_ID}
  `;
  expect(row).toEqual({ name: 'Test indicator', migrations: 1, topics: 1 });
}

describe('applyDataMigration', () => {
  it('loads a baseline, enforces predecessor order and preserves idempotence', async () => {
    expect((await baseline()).applied).toBe(true);
    await expect(apply({ predecessor: 'wrong' })).rejects.toThrow(/predecessor/);
    const fixture = await migrationFixture(sql, directory, topicId);
    const first = await sql.begin((tx) =>
      applyDataMigration(tx, directory, fixture.manifest, fixture.sha256),
    );
    const second = await sql.begin((tx) =>
      applyDataMigration(tx, directory, fixture.manifest, fixture.sha256),
    );
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    await expect(
      sql.begin((tx) => applyDataMigration(tx, directory, fixture.manifest, 'f'.repeat(64))),
    ).rejects.toThrow('already applied with another package');
    const [row] = await sql<{ count: number; shortId: number }[]>`
      SELECT (SELECT count(*)::int FROM data_migration) AS count,
        nextval('indicator_short_id_seq')::int AS "shortId"
    `;
    expect(row).toEqual({ count: 2, shortId: 100000 });
  });
  it('refuses a baseline on nonempty target tables', async () => {
    await sql`INSERT INTO indicator (id, short_id) VALUES (${INDICATOR_ID}, 108)`;
    await expect(baseline()).rejects.toThrow('Baseline target table indicator is not empty');
  });
  it('checks declared baseline row counts', async () => {
    const fixture = await migrationFixture(sql, directory, topicId, { baseline: true });
    if (fixture.manifest.kind !== 'baseline') throw new Error('Expected baseline');
    const entry = fixture.manifest.tables.indicator;
    if (!entry) throw new Error('Missing indicator entry');
    entry.rows = 2;
    await expect(
      sql.begin((tx) => applyDataMigration(tx, directory, fixture.manifest, fixture.sha256)),
    ).rejects.toThrow('Baseline row count failed for indicator');
  });
  it.each([
    [
      ['id', 'name', 'hierarchy_type', 'level', 'bogus_column'],
      'columns the target table does not: bogus_column',
    ],
    [['id', 'hierarchy_type', 'level'], 'missing required columns: name'],
    [['name', 'hierarchy_type', 'level'], 'missing required columns: id'],
  ])('refuses invalid area_type headers: %j', async (columns, error) => {
    await baseline();
    await expect(
      apply({ upserts: { area_type: { columns: columns as string[] } } }),
    ).rejects.toThrow(error as string);
    await assertRolledBack();
  });
  it('requires imported numeric indicator identities', async () => {
    await baseline();
    await expect(apply({ upserts: { indicator: { columns: ['id'] } } })).rejects.toThrow(
      'missing required columns: short_id',
    );
  });
  it.each(
    [VERSION_COLUMNS.slice(0, -2), VERSION_COLUMNS.slice(0, -1)].map((columns) => ({ columns })),
  )('rejects a version header missing legacy source columns: %j', async ({ columns }) => {
    await baseline();
    await expect(
      apply({
        upserts: { indicator_version: { columns, rows: [VERSION_ROW.slice(0, columns.length)] } },
      }),
    ).rejects.toThrow('missing required columns:');
    await assertRolledBack();
  });
  it('records zero applied rows for staged reference tables', async () => {
    await baseline();
    const applied = await apply({
      upserts: {
        numerator_denominator_source: {
          columns: ['id', 'name', 'url'],
          rows: [[SOURCE_ID, 'Not applicable (N/A)', null]],
        },
      },
    });
    expect(applied.changes.numerator_denominator_source).toEqual({ upserts: 0, deletes: 0 });
    const [ledger] = await sql<
      { changes: unknown }[]
    >`SELECT table_changes->'numerator_denominator_source' AS changes FROM data_migration WHERE id = 'increment-2'`;
    expect(ledger?.changes).toEqual({ upserts: 0, deletes: 0 });
  });
  it('preserves sequence allocations consumed by rolled-back publisher writes', async () => {
    await baseline();
    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO indicator DEFAULT VALUES`;
        throw new Error('publisher rollback');
      }),
    ).rejects.toThrow('publisher rollback');
    await apply();
    const [created] = await sql<
      { shortId: number }[]
    >`INSERT INTO indicator DEFAULT VALUES RETURNING short_id AS "shortId"`;
    expect(created?.shortId).toBe(100001);
  });
  it('waits for concurrent publisher identities and never reissues their IDs', async () => {
    await baseline();
    const publisher = createOwnerClient(database.name);
    const observer = createOwnerClient(database.name);
    let release!: () => void;
    let ready!: () => void;
    const acquired = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = publisher.begin(async (tx) => {
      await tx`INSERT INTO indicator DEFAULT VALUES`;
      ready();
      await held;
    });
    let migrating: ReturnType<typeof apply> | undefined;
    try {
      await acquired;
      migrating = apply();
      await vi.waitFor(async () => {
        const [lock] = await observer<{ waiting: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_locks WHERE relation = 'indicator'::regclass
            AND mode = 'ShareRowExclusiveLock' AND NOT granted) AS waiting
        `;
        expect(lock?.waiting).toBe(true);
      });
      release();
      await pending;
      await migrating;
      const [created] = await publisher<
        { shortId: number }[]
      >`INSERT INTO indicator DEFAULT VALUES RETURNING short_id AS "shortId"`;
      expect(created?.shortId).toBe(100001);
    } finally {
      release();
      await pending;
      await migrating;
      await publisher.end();
      await observer.end();
    }
  });
  it('names unknown topic and classification IDs in relationship errors', async () => {
    await baseline();
    await expect(
      apply({ relationships: { indicatorTopics: [{ fingertipsId: 108, topicId: SOURCE_ID }] } }),
    ).rejects.toThrow(`unknown topics: ${SOURCE_ID}`);
    await expect(
      apply({
        relationships: {
          indicatorClassifications: [{ fingertipsId: 108, classificationId: SOURCE_ID }],
        },
      }),
    ).rejects.toThrow(`unknown classifications: ${SOURCE_ID}`);
    await assertRolledBack();
  });
  it.each([
    { indicators: [], error: 'published indicators absent from coverage: 108' },
    { indicators: [108, 109], error: 'declared indicators without a published version: 109' },
  ])(
    'names mismatched indicator coverage and rolls back: $error',
    async ({ indicators, error }) => {
      await baseline();
      await expect(apply({ relationships: { indicators, indicatorTopics: [] } })).rejects.toThrow(
        error,
      );
      await assertRolledBack();
    },
  );
  it('names identities whose deletion is blocked by publisher uploads', async () => {
    await baseline();
    await sql`INSERT INTO upload_batch (indicator_id, original_filename, uploaded_by) VALUES (${INDICATOR_ID}, 'publisher.csv', 'publisher')`;
    await expect(
      apply({
        deletes: { indicator: [INDICATOR_ID], indicator_version: [VERSION_ID] },
        relationships: { indicators: [], indicatorTopics: [] },
      }),
    ).rejects.toThrow(
      `indicator deletion is blocked by retained references (ids: ${INDICATOR_ID})`,
    );
    await assertRolledBack();
  });
  it.each([0, 2])(
    'rejects a declared delete count of %s before deleting its staged row',
    async (rows) => {
      await baseline();
      await sql`INSERT INTO upload_batch (indicator_id, original_filename, uploaded_by) VALUES (${INDICATOR_ID}, 'publisher.csv', 'publisher')`;
      await expect(
        apply({
          deletes: { indicator: [INDICATOR_ID], indicator_version: [VERSION_ID] },
          deleteRows: { indicator: rows },
          relationships: { indicators: [], indicatorTopics: [] },
        }),
      ).rejects.toThrow(`indicator staged 1 deletes; package declares ${rows}`);
      await assertRolledBack();
    },
  );
  it('refuses a mislabeled delete header and retains the target row', async () => {
    await baseline({
      upserts: { data_source: { columns: ['id', 'name'], rows: [[SOURCE_ID, 'Retained source']] } },
    });
    await expect(
      apply({ deletes: { data_source: [SOURCE_ID] }, deleteHeaders: { data_source: ['name'] } }),
    ).rejects.toThrow(
      'data_migration_delete_data_source CSV has columns the target table does not: name',
    );
    const [row] = await sql<
      { name: string }[]
    >`SELECT name FROM data_source WHERE id = ${SOURCE_ID}`;
    expect(row?.name).toBe('Retained source');
    await assertRolledBack();
  });
  it('maps source CI method names to core UUIDs', async () => {
    await baseline();
    const row = [...VERSION_ROW];
    row[8] = SOURCE_ID;
    await apply({
      upserts: {
        indicator_version: { columns: VERSION_COLUMNS, rows: [row] },
        ci_method: {
          columns: ['id', 'name', 'description'],
          rows: [[SOURCE_ID, 'Normal approximation', null]],
        },
      },
    });
    const [loaded] = await sql<{ name: string }[]>`
      SELECT c.name FROM indicator_version v JOIN ci_method c ON c.id = v.ci_method_id WHERE v.id = ${VERSION_ID}
    `;
    expect(loaded?.name).toBe('Wald normal approximation');
  });
  it('leaves sources of unchanged versions intact', async () => {
    await baseline({
      upserts: {
        indicator_version: version([SOURCE_ID, null]),
        numerator_denominator_source: {
          columns: ['id', 'name', 'url'],
          rows: [[SOURCE_ID, 'Care Quality Commission (CQC), Care directory', null]],
        },
      },
    });
    await apply();
    expect(await sourceCount()).toBe(1);
  });
  it.each([null, 'Not applicable (N/A)'])(
    'removes obsolete numerator and denominator sources for %s',
    async (name) => {
      await baseline({
        upserts: {
          indicator_version: version([SOURCE_ID, SOURCE_ID]),
          numerator_denominator_source: {
            columns: ['id', 'name', 'url'],
            rows: [[SOURCE_ID, 'Care Quality Commission (CQC), Care directory', null]],
          },
        },
      });
      expect(await sourceCount()).toBe(2);
      await apply({
        upserts: {
          indicator_version: version(name === null ? [null, null] : [SOURCE_ID, SOURCE_ID]),
          numerator_denominator_source: {
            columns: ['id', 'name', 'url'],
            rows: name === null ? [] : [[SOURCE_ID, name, null]],
          },
        },
      });
      expect(await sourceCount()).toBe(0);
    },
  );
  it('shrinks source mappings and reads a reordered legacy source header by name', async () => {
    await baseline({
      upserts: {
        indicator_version: version([SOURCE_ID, null]),
        numerator_denominator_source: {
          columns: ['name', 'url', 'id'],
          rows: [
            [
              'Ministry of Housing, Communities and Local Government (MHCLG), Homelessness statistics and Department for Energy Security and Net Zero (DESNZ), Fuel poverty statistics',
              null,
              SOURCE_ID,
            ],
          ],
        },
      },
    });
    expect(await sourceCount()).toBe(2);
    await apply({
      upserts: {
        indicator_version: version([SOURCE_ID, null]),
        numerator_denominator_source: {
          columns: ['name', 'id', 'url'],
          rows: [['Care Quality Commission (CQC), Care directory', SOURCE_ID, null]],
        },
      },
    });
    expect(await sourceCount()).toBe(1);
    const [provider] = await sql<{ name: string }[]>`
      SELECT p.name FROM indicator_version_source s JOIN data_provider p ON p.id = s.provider_id WHERE s.indicator_version_id = ${VERSION_ID}
    `;
    expect(provider?.name).toBe('Care Quality Commission (CQC)');
  });
  it.each([
    { columns: ['id', 'name'], rows: [['invalid-uuid', 'Bad source']], code: '22P02' },
    { columns: ['id', 'name'], rows: [[SOURCE_ID, 'Bad source', 'extra']], code: '22P04' },
  ])(
    'rejects COPY errors after EOF and leaves the connection usable: $code',
    async ({ columns, rows, code }) => {
      await baseline();
      await expect(apply({ upserts: { data_source: { columns, rows } } })).rejects.toMatchObject({
        code,
      });
      await assertRolledBack();
      expect((await apply()).applied).toBe(true);
    },
  );
  it('preserves historical and draft topics, classifications and answers', async () => {
    await baseline();
    const preserved = await sql<{ id: string }[]>`
      INSERT INTO indicator_version (indicator_id, status, published_at, name, slug, created_by, updated_by, has_framework)
      VALUES (${INDICATOR_ID}, 'published', '2025-01-01', 'History', 'test-indicator', 'publisher', 'publisher', true),
        (${INDICATOR_ID}, 'draft', NULL, 'Draft', 'test-indicator', 'publisher', 'publisher', true)
      RETURNING id
    `;
    for (const { id } of preserved) {
      await sql`INSERT INTO indicator_version_topic (indicator_version_id, topic_id) VALUES (${id}, ${topicId})`;
      await sql`INSERT INTO indicator_version_classification (indicator_version_id, classification_id) VALUES (${id}, ${frameworkId})`;
    }
    await apply({ upserts: { indicator_version: version() } });
    const rows = await sql<
      { status: string; topics: number; classifications: number; hasFramework: boolean }[]
    >`
      SELECT v.status, v.has_framework AS "hasFramework",
        (SELECT count(*)::int FROM indicator_version_topic t WHERE t.indicator_version_id = v.id) AS topics,
        (SELECT count(*)::int FROM indicator_version_classification c WHERE c.indicator_version_id = v.id) AS classifications
      FROM indicator_version v WHERE v.id IN ${sql(preserved.map(({ id }) => id))} ORDER BY status
    `;
    expect(rows).toEqual([
      { status: 'draft', hasFramework: true, topics: 1, classifications: 1 },
      { status: 'published', hasFramework: true, topics: 1, classifications: 1 },
    ]);
  });
  it('allows unrelated draft-only indicators without changing them', async () => {
    await baseline();
    const [identity] = await sql<
      { id: string }[]
    >`INSERT INTO indicator DEFAULT VALUES RETURNING id`;
    const [draft] = await sql<{ id: string }[]>`
      INSERT INTO indicator_version (indicator_id, name, slug, created_by, updated_by)
      VALUES (${identity?.id ?? ''}, 'Publisher draft', 'publisher-draft', 'publisher', 'publisher') RETURNING id
    `;
    await sql`INSERT INTO indicator_version_topic (indicator_version_id, topic_id) VALUES (${draft?.id ?? ''}, ${topicId})`;
    await apply();
    const [row] = await sql<{ name: string; topics: number }[]>`
      SELECT name, (SELECT count(*)::int FROM indicator_version_topic WHERE indicator_version_id = v.id) AS topics
      FROM indicator_version v WHERE id = ${draft?.id ?? ''}
    `;
    expect(row).toEqual({ name: 'Publisher draft', topics: 1 });
  });
  it('refuses non-published source versions and rolls back the increment', async () => {
    await baseline();
    const row = [...VERSION_ROW];
    row[2] = 'draft';
    row[3] = null;
    await expect(
      apply({ upserts: { indicator_version: { columns: VERSION_COLUMNS, rows: [row] } } }),
    ).rejects.toThrow('contains a non-published indicator version');
    await assertRolledBack();
  });
  it('refuses source versions that would overwrite a publisher draft', async () => {
    await baseline();
    const [draft] = await sql<{ id: string }[]>`
      INSERT INTO indicator_version (indicator_id, name, slug, created_by, updated_by)
      VALUES (${INDICATOR_ID}, 'Publisher draft', 'test-indicator', 'publisher', 'publisher') RETURNING id
    `;
    const row = [...VERSION_ROW];
    row[0] = draft?.id ?? '';
    await expect(
      apply({ upserts: { indicator_version: { columns: VERSION_COLUMNS, rows: [row] } } }),
    ).rejects.toThrow('would overwrite a non-published indicator version');
    await assertRolledBack();
  });
  it('refuses source deletions that would remove a publisher draft', async () => {
    await baseline();
    const [draft] = await sql<{ id: string }[]>`
      INSERT INTO indicator_version (indicator_id, name, slug, created_by, updated_by)
      VALUES (${INDICATOR_ID}, 'Publisher draft', 'test-indicator', 'publisher', 'publisher') RETURNING id
    `;
    await expect(apply({ deletes: { indicator_version: [draft?.id ?? ''] } })).rejects.toThrow(
      'would delete a non-published indicator version',
    );
    await assertRolledBack();
    const [remaining] = await sql<
      { name: string }[]
    >`SELECT name FROM indicator_version WHERE id = ${draft?.id ?? ''}`;
    expect(remaining?.name).toBe('Publisher draft');
  });
  it('refuses source indicators with no published version or reviewed topic coverage', async () => {
    await baseline();
    await expect(
      apply({ upserts: { indicator: { columns: ['id', 'short_id'], rows: [[SOURCE_ID, 109]] } } }),
    ).rejects.toThrow('source indicators are missing from reviewed relationship coverage: 109');
    await assertRolledBack();
  });
  it('clears removed classification answers and retains answers backed by assignments', async () => {
    await baseline({
      relationships: {
        indicatorClassifications: [
          { fingertipsId: 108, classificationId: frameworkId },
          { fingertipsId: 108, classificationId: riskFactorId },
        ],
      },
    });
    await apply({
      relationships: {
        indicatorClassifications: [{ fingertipsId: 108, classificationId: riskFactorId }],
      },
    });
    const [row] = await sql<{ framework: boolean | null; risk: boolean | null }[]>`
      SELECT has_framework AS framework, has_risk_factor AS risk FROM indicator_version WHERE id = ${VERSION_ID}
    `;
    expect(row).toEqual({ framework: null, risk: true });
    await apply({
      predecessor: 'increment-2',
      migrationId: 'increment-3',
      cutoffAt: '2026-09-23T10:00:00Z',
    });
    const [removed] = await sql<
      { risk: boolean | null }[]
    >`SELECT has_risk_factor AS risk FROM indicator_version WHERE id = ${VERSION_ID}`;
    expect(removed?.risk).toBeNull();
  });
  it('retains explicit negative classification answers', async () => {
    await baseline();
    await sql`UPDATE indicator_version SET has_framework = false, has_risk_factor = false WHERE id = ${VERSION_ID}`;
    await apply();
    const [row] = await sql<{ framework: boolean; risk: boolean }[]>`
      SELECT has_framework AS framework, has_risk_factor AS risk FROM indicator_version WHERE id = ${VERSION_ID}
    `;
    expect(row).toEqual({ framework: false, risk: false });
  });
  it('refuses missing topics and rolls back source edits, relationships and the ledger', async () => {
    await baseline();
    const [history] = await sql<{ id: string }[]>`
      INSERT INTO indicator_version (indicator_id, status, published_at, name, slug, created_by, updated_by)
      VALUES (${INDICATOR_ID}, 'published', '2025-01-01', 'History', 'test-indicator', 'publisher', 'publisher') RETURNING id
    `;
    await sql`INSERT INTO indicator_version_topic (indicator_version_id, topic_id) VALUES (${history?.id ?? ''}, ${topicId})`;
    const row = [...VERSION_ROW];
    row[4] = 'Changed name';
    await expect(
      apply({
        relationships: { indicatorTopics: [] },
        upserts: { indicator_version: { columns: VERSION_COLUMNS, rows: [row] } },
      }),
    ).rejects.toThrow('Migrated indicators have no topic: 108 (Changed name)');
    await assertRolledBack();
  });
  it.each(['link', 'age range'])(
    'protects publisher %s rows when source versions are deleted',
    async (child) => {
      await baseline();
      if (child === 'link') {
        await sql`INSERT INTO indicator_version_link (indicator_version_id, position, url, text) VALUES (${VERSION_ID}, 0, 'https://example.test', 'Publisher link')`;
      } else {
        await sql`INSERT INTO indicator_version_age_range (indicator_version_id, position, lower_limit, lower_limit_unit) VALUES (${VERSION_ID}, 0, 18, 'years')`;
      }
      const options = {
        deletes: { indicator: [INDICATOR_ID], indicator_version: [VERSION_ID] },
        relationships: { indicators: [], indicatorTopics: [] },
      };
      await expect(apply(options)).rejects.toThrow('publisher links or age ranges');
      await assertRolledBack();
      await sql`DELETE FROM indicator_version_link WHERE indicator_version_id = ${VERSION_ID}`;
      await sql`DELETE FROM indicator_version_age_range WHERE indicator_version_id = ${VERSION_ID}`;
      await apply(options);
      const [row] = await sql<{ indicators: number; topics: number }[]>`
      SELECT (SELECT count(*)::int FROM indicator) AS indicators,
        (SELECT count(*)::int FROM indicator_version_topic) AS topics
    `;
      expect(row).toEqual({ indicators: 0, topics: 0 });
    },
  );
});
