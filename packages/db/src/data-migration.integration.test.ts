import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyDataMigration } from './data-migration.ts';
import {
  DATA_MIGRATION_FORMAT_VERSION,
  DATA_MIGRATION_NULL,
  DATA_MIGRATION_SCHEMA,
  DATA_MIGRATION_TABLES,
  dataMigrationManifestSchema,
} from './data-migration-manifest.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

let database: TestDatabase;
let sql: postgres.Sql;
let directory: string;
let topicId: string;

beforeAll(async () => {
  database = await createTestDatabase({ template: 'schema' });
  sql = createOwnerClient(database.name);
  directory = await mkdtemp(join(tmpdir(), 'fphd-data-migration-test-'));
  const [topic] = await sql<{ id: string }[]>`
    INSERT INTO topic (slug, title, description)
    VALUES ('migration', 'Migration topic', 'Integration fixture') RETURNING id
  `;
  topicId = topic?.id ?? '';
});

afterAll(async () => {
  await sql.end();
  await database.drop();
  await rm(directory, { recursive: true });
});

/**
 * Builds a minimal incremental package in `directory`. The CSV headers list each table's columns
 * in reverse, so the importer must match them by name rather than by position.
 * ci_method and comparator_method are core data: their CSVs are present for staging but their
 * rows are never directly inserted.
 */
async function incremental(
  predecessor = 'baseline-1',
  migrationId = 'increment-2',
  cutoffAt = '2026-09-22T10:00:00Z',
) {
  const indicators = (
    await sql<{ shortId: number }[]>`SELECT short_id AS "shortId" FROM indicator ORDER BY short_id`
  ).map(({ shortId }) => shortId);
  await writeFile(
    join(directory, 'indicator-relationships.json'),
    JSON.stringify({
      approval: {
        approvedBy: 'migration test',
        approvedAt: '2026-09-22T10:00:00Z',
        basis: 'integration fixture',
      },
      indicators,
      indicatorTopics: indicators.map((fingertipsId) => ({ topicId, fingertipsId })),
      indicatorDataUpdatedAt: {},
      classifications: [],
      indicatorClassifications: [],
    }),
  );

  // Core data tables: exported with source columns, staged for FK mapping but never inserted.
  const coreDataCsvs: Record<string, string> = {
    ci_method: 'id,name,description\n',
    comparator_method: 'id,name\n',
  };

  // numerator_denominator_source: staged for legacy source resolution, no live table.
  const stagedOnlyCsvs: Record<string, string> = {
    numerator_denominator_source: 'id,name,url\n',
  };

  // indicator_version requires name-based columns (may arrive in any order from the export).
  // Required NOT NULL-without-default columns must be present; optional columns may be omitted.
  const indicatorVersionHeader = 'id,indicator_id,status,name,slug,created_by,updated_by';

  const tables: Record<
    string,
    {
      upserts: { file: string; rows: number; bytes: number; sha256: string };
      deletes: { file: string; rows: number; bytes: number; sha256: string };
    }
  > = {};

  for (const table of DATA_MIGRATION_TABLES) {
    let upsert: string;
    if (table in coreDataCsvs) {
      upsert = coreDataCsvs[table] as string;
    } else if (table in stagedOnlyCsvs) {
      upsert = stagedOnlyCsvs[table] as string;
    } else if (table === 'indicator_version') {
      upsert = `${indicatorVersionHeader}\n`;
    } else {
      const columns = (
        await sql<{ column: string }[]>`
          SELECT attname AS column
          FROM pg_attribute
          WHERE attrelid = ${table}::regclass AND attnum > 0 AND NOT attisdropped
          ORDER BY attnum DESC
        `
      ).map(({ column }) => column);
      upsert = `${columns.join(',')}\n`;
    }

    await writeFile(join(directory, `${table}.csv.gz`), gzipSync(upsert));
    await writeFile(join(directory, `${table}.deletes.csv.gz`), gzipSync('id\n'));
    tables[table] = {
      upserts: { file: `${table}.csv.gz`, rows: 0, bytes: 1, sha256: 'a'.repeat(64) },
      deletes: { file: `${table}.deletes.csv.gz`, rows: 0, bytes: 1, sha256: 'b'.repeat(64) },
    };
  }

  return dataMigrationManifestSchema.parse({
    format_version: DATA_MIGRATION_FORMAT_VERSION,
    schema: DATA_MIGRATION_SCHEMA,
    migration_id: migrationId,
    kind: 'incremental',
    predecessor,
    source: {
      system: 'fingertips',
      environment: 'live',
      database: 'source',
      snapshot_at: cutoffAt,
      cutoff_at: cutoffAt,
    },
    source_csv_null: DATA_MIGRATION_NULL,
    id_mapping: 'deterministic-uuidv7-v1',
    relationships: {
      file: 'indicator-relationships.json',
      rows: indicators.length,
      bytes: 1,
      sha256: 'c'.repeat(64),
    },
    tables,
  });
}

/** Writes a gzipped CSV for `table` with the given header and rows to `directory`. */
async function writeCsv(dir: string, filename: string, header: string, rows: string[] = []) {
  const content = `${[header, ...rows].join('\n')}\n`;
  await writeFile(join(dir, filename), gzipSync(content));
}

describe('applyDataMigration', () => {
  it('enforces predecessor order, applies an increment and is idempotent', async () => {
    await sql`
      INSERT INTO data_migration
        (id, kind, package_sha256, predecessor_id, source_snapshot_at, source_cutoff_at, table_changes)
      VALUES ('baseline-1', 'baseline', ${'d'.repeat(64)}, NULL,
        '2026-09-21T10:00:00Z', '2026-09-21T10:00:00Z', '{}'::jsonb)
    `;
    const wrong = await incremental('wrong');
    await expect(
      sql.begin((tx) => applyDataMigration(tx, directory, wrong, 'e'.repeat(64))),
    ).rejects.toThrow(/predecessor/);

    const manifest = await incremental();

    const first = await sql.begin((tx) =>
      applyDataMigration(tx, directory, manifest, 'e'.repeat(64)),
    );
    const second = await sql.begin((tx) =>
      applyDataMigration(tx, directory, manifest, 'e'.repeat(64)),
    );

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    const [ledger] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM data_migration WHERE id = 'increment-2'
    `;
    expect(ledger?.count).toBe(1);
    const [sequence] = await sql<{ shortId: number }[]>`
      SELECT nextval('indicator_short_id_seq')::int AS "shortId"
    `;
    expect(sequence?.shortId).toBe(100000);
  });

  it('refuses a CSV with an unknown column', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fphd-dm-bad-col-'));
    try {
      const manifest = await incremental(
        'increment-2',
        'increment-bad-col',
        '2026-09-23T10:00:00Z',
      );
      // Override area_type with an extra column the table does not have.
      await writeCsv(dir, 'area_type.csv.gz', 'id,name,hierarchy_type,level,bogus_column');
      await writeFile(join(dir, 'area_type.deletes.csv.gz'), gzipSync('id\n'));
      // Copy the other files from the shared directory.
      for (const table of DATA_MIGRATION_TABLES) {
        if (table === 'area_type') continue;
        const src = join(directory, `${table}.csv.gz`);
        const dst = join(dir, `${table}.csv.gz`);
        await writeFile(dst, await import('node:fs/promises').then((m) => m.readFile(src)));
        const srcD = join(directory, `${table}.deletes.csv.gz`);
        const dstD = join(dir, `${table}.deletes.csv.gz`);
        await writeFile(dstD, await import('node:fs/promises').then((m) => m.readFile(srcD)));
      }
      await writeFile(
        join(dir, 'indicator-relationships.json'),
        await import('node:fs/promises').then((m) =>
          m.readFile(join(directory, 'indicator-relationships.json')),
        ),
      );
      await expect(
        sql.begin((tx) => applyDataMigration(tx, dir, manifest, 'f'.repeat(64))),
      ).rejects.toThrow(/area_type CSV has columns the target table does not: bogus_column/);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('refuses a CSV missing a required NOT NULL column', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fphd-dm-missing-col-'));
    try {
      const manifest = await incremental(
        'increment-2',
        'increment-missing-col',
        '2026-09-24T10:00:00Z',
      );
      // area_type.name is NOT NULL without a default — omitting it must be refused.
      await writeCsv(dir, 'area_type.csv.gz', 'id,hierarchy_type,level');
      await writeFile(join(dir, 'area_type.deletes.csv.gz'), gzipSync('id\n'));
      for (const table of DATA_MIGRATION_TABLES) {
        if (table === 'area_type') continue;
        const src = join(directory, `${table}.csv.gz`);
        await writeFile(
          join(dir, `${table}.csv.gz`),
          await import('node:fs/promises').then((m) => m.readFile(src)),
        );
        const srcD = join(directory, `${table}.deletes.csv.gz`);
        await writeFile(
          join(dir, `${table}.deletes.csv.gz`),
          await import('node:fs/promises').then((m) => m.readFile(srcD)),
        );
      }
      await writeFile(
        join(dir, 'indicator-relationships.json'),
        await import('node:fs/promises').then((m) =>
          m.readFile(join(directory, 'indicator-relationships.json')),
        ),
      );
      await expect(
        sql.begin((tx) => applyDataMigration(tx, dir, manifest, 'f'.repeat(64))),
      ).rejects.toThrow(/area_type CSV is missing required columns: name/);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('maps ci_method_id from source UUID to core UUID in indicator_version', async () => {
    const sourceCiMethodId = 'bbbbbbbb-bbbb-7bbb-bbbb-bbbbbbbbbbbb';
    // Insert a core ci_method row with a known name.
    const coreCiMethodId = 'cccccccc-cccc-7ccc-cccc-cccccccccccc';
    await sql.unsafe(`
      INSERT INTO ci_method (id, name, kind) VALUES ('${coreCiMethodId}', 'Test CI Method', 'standard')
      ON CONFLICT DO NOTHING
    `);
    // Insert a core area_type, area and indicator so indicator_version FKs resolve.
    const areaTypeId = 'dddddddd-dddd-7ddd-dddd-dddddddddddd';
    const areaId = 'eeeeeeee-eeee-7eee-eeee-eeeeeeeeeeee';
    const indicatorId = 'ffffffff-ffff-7fff-ffff-ffffffffffff';
    const versionId = '11111111-1111-7111-1111-111111111111';
    await sql.unsafe(`
      INSERT INTO area_type (id, name, hierarchy_type, level) VALUES ('${areaTypeId}', 'Test Type', 'Administrative', 1)
      ON CONFLICT DO NOTHING
    `);
    await sql.unsafe(`
      INSERT INTO area (id, code, name, area_type_id, valid_from)
      VALUES ('${areaId}', 'E00001', 'Test Area', '${areaTypeId}', '2020-01-01')
      ON CONFLICT DO NOTHING
    `);
    await sql.unsafe(`
      INSERT INTO indicator (id) VALUES ('${indicatorId}') ON CONFLICT DO NOTHING
    `);

    // indicator_version CSV carries source ci_method_id; ci_method CSV carries source row.
    const ivHeader =
      'id,indicator_id,status,published_at,name,slug,created_by,updated_by,ci_method_id';
    const ivRow = `${versionId},${indicatorId},published,2026-01-01 00:00:00+00,Test Indicator,test-indicator,system,system,${sourceCiMethodId}`;
    const ciMethodCsv = `id,name,description\n${sourceCiMethodId},Test CI Method,A description\n`;

    const testDir = await mkdtemp(join(tmpdir(), 'fphd-dm-core-map-'));
    try {
      const [indicator] = await sql<{ shortId: number }[]>`
        SELECT short_id AS "shortId" FROM indicator WHERE id = ${indicatorId}
      `;
      await writeFile(
        join(testDir, 'indicator-relationships.json'),
        JSON.stringify({
          approval: { approvedBy: 'test', approvedAt: '2026-09-25T10:00:00Z', basis: 'test' },
          indicators: [indicator?.shortId ?? 0],
          indicatorTopics: [{ topicId, fingertipsId: indicator?.shortId ?? 0 }],
          indicatorDataUpdatedAt: {},
          classifications: [],
          indicatorClassifications: [],
        }),
      );

      for (const table of DATA_MIGRATION_TABLES) {
        let upsert: string;
        if (table === 'ci_method') {
          upsert = ciMethodCsv;
        } else if (table === 'indicator_version') {
          upsert = `${ivHeader}\n${ivRow}\n`;
        } else if (table === 'comparator_method') {
          upsert = 'id,name\n';
        } else if (table === 'numerator_denominator_source') {
          upsert = 'id,name,url\n';
        } else {
          const cols = (
            await sql<{ column: string }[]>`
              SELECT attname AS column FROM pg_attribute
              WHERE attrelid = ${table}::regclass AND attnum > 0 AND NOT attisdropped
              ORDER BY attnum
            `
          ).map(({ column }) => column);
          upsert = `${cols.join(',')}\n`;
        }
        await writeFile(join(testDir, `${table}.csv.gz`), gzipSync(upsert));
        await writeFile(join(testDir, `${table}.deletes.csv.gz`), gzipSync('id\n'));
      }

      const manifest = dataMigrationManifestSchema.parse({
        format_version: DATA_MIGRATION_FORMAT_VERSION,
        schema: DATA_MIGRATION_SCHEMA,
        migration_id: 'increment-core-map',
        kind: 'incremental',
        predecessor: 'increment-2',
        source: {
          system: 'fingertips',
          environment: 'live',
          database: 'source',
          snapshot_at: '2026-09-25T10:00:00Z',
          cutoff_at: '2026-09-25T10:00:00Z',
        },
        source_csv_null: DATA_MIGRATION_NULL,
        id_mapping: 'deterministic-uuidv7-v1',
        relationships: {
          file: 'indicator-relationships.json',
          rows: 1,
          bytes: 1,
          sha256: 'a'.repeat(64),
        },
        tables: Object.fromEntries(
          DATA_MIGRATION_TABLES.map((t) => [
            t,
            {
              upserts: {
                file: `${t}.csv.gz`,
                rows: t === 'indicator_version' || t === 'ci_method' ? 1 : 0,
                bytes: 1,
                sha256: 'a'.repeat(64),
              },
              deletes: { file: `${t}.deletes.csv.gz`, rows: 0, bytes: 1, sha256: 'b'.repeat(64) },
            },
          ]),
        ),
      });

      await sql.begin((tx) => applyDataMigration(tx, testDir, manifest, 'f'.repeat(64)));

      const [loaded] = await sql<{ ciMethodId: string }[]>`
        SELECT ci_method_id::text AS "ciMethodId" FROM indicator_version WHERE id = ${versionId}
      `;
      expect(loaded?.ciMethodId).toBe(coreCiMethodId);
    } finally {
      await rm(testDir, { recursive: true });
    }
  });

  it('refuses indicators without topics and rolls back the relationships and ledger', async () => {
    const manifest = await incremental(
      'increment-core-map',
      'increment-without-topics',
      '2026-09-26T10:00:00Z',
    );
    const path = join(directory, 'indicator-relationships.json');
    const relationships = JSON.parse(await readFile(path, 'utf8'));
    await writeFile(path, JSON.stringify({ ...relationships, indicatorTopics: [] }));
    const [indicator] = await sql<{ shortId: number; name: string }[]>`
      SELECT i.short_id AS "shortId", v.name
      FROM indicator i JOIN indicator_version v ON v.indicator_id = i.id
    `;

    await expect(
      sql.begin((tx) => applyDataMigration(tx, directory, manifest, '2'.repeat(64))),
    ).rejects.toThrow(
      `Migrated indicators have no topic: ${indicator?.shortId} (${indicator?.name})`,
    );
    const [remaining] = await sql<{ topics: number; migrations: number }[]>`
      SELECT (SELECT count(*)::int FROM indicator_version_topic) AS topics,
        (SELECT count(*)::int FROM data_migration
         WHERE id = 'increment-without-topics') AS migrations
    `;
    expect(remaining).toEqual({ topics: 1, migrations: 0 });
  });

  it('deletes a version with the rows the migration wrote against it, unless publishers added to it', async () => {
    const indicatorId = 'ffffffff-ffff-7fff-ffff-ffffffffffff';
    const versionId = '11111111-1111-7111-1111-111111111111';
    const [topic] = await sql<{ id: string }[]>`
      INSERT INTO topic (slug, title, description) VALUES ('t', 'Topic', 'A topic') RETURNING id
    `;
    const [classification] = await sql<{ id: string }[]>`
      INSERT INTO classification (dimension, slug, name)
      VALUES ('framework', 'c', 'Classification') RETURNING id
    `;
    const [provider] = await sql<{ id: string }[]>`
      INSERT INTO data_provider (name) VALUES ('Provider') RETURNING id
    `;
    await sql`
      INSERT INTO indicator_version_topic (topic_id, indicator_version_id)
      VALUES (${topic?.id ?? ''}, ${versionId})
    `;
    await sql`
      INSERT INTO indicator_version_classification (classification_id, indicator_version_id)
      VALUES (${classification?.id ?? ''}, ${versionId})
    `;
    await sql`
      INSERT INTO indicator_version_source (indicator_version_id, part, position, provider_id)
      VALUES (${versionId}, 'numerator', 0, ${provider?.id ?? ''})
    `;
    await sql`
      INSERT INTO indicator_version_link (indicator_version_id, position, url, text)
      VALUES (${versionId}, 0, 'https://example.test', 'Publisher link')
    `;

    const testDir = await mkdtemp(join(tmpdir(), 'fphd-dm-delete-'));
    try {
      await writeFile(
        join(testDir, 'indicator-relationships.json'),
        JSON.stringify({
          approval: { approvedBy: 'test', approvedAt: '2026-09-26T10:00:00Z', basis: 'test' },
          indicators: [],
          indicatorTopics: [],
          indicatorDataUpdatedAt: {},
          classifications: [],
          indicatorClassifications: [],
        }),
      );
      const deletes: Partial<Record<string, string>> = {
        indicator: indicatorId,
        indicator_version: versionId,
      };
      for (const table of DATA_MIGRATION_TABLES) {
        let upsert: string;
        if (table === 'indicator_version') {
          upsert = 'id,indicator_id,status,name,slug,created_by,updated_by\n';
        } else if (table === 'ci_method') {
          upsert = 'id,name,description\n';
        } else if (table === 'comparator_method') {
          upsert = 'id,name\n';
        } else if (table === 'numerator_denominator_source') {
          upsert = 'id,name,url\n';
        } else {
          const cols = (
            await sql<{ column: string }[]>`
              SELECT attname AS column FROM pg_attribute
              WHERE attrelid = ${table}::regclass AND attnum > 0 AND NOT attisdropped
              ORDER BY attnum
            `
          ).map(({ column }) => column);
          upsert = `${cols.join(',')}\n`;
        }
        const deleted = deletes[table];
        await writeFile(join(testDir, `${table}.csv.gz`), gzipSync(upsert));
        await writeFile(
          join(testDir, `${table}.deletes.csv.gz`),
          gzipSync(deleted ? `id\n${deleted}\n` : 'id\n'),
        );
      }
      const manifest = dataMigrationManifestSchema.parse({
        format_version: DATA_MIGRATION_FORMAT_VERSION,
        schema: DATA_MIGRATION_SCHEMA,
        migration_id: 'increment-delete',
        kind: 'incremental',
        predecessor: 'increment-core-map',
        source: {
          system: 'fingertips',
          environment: 'live',
          database: 'source',
          snapshot_at: '2026-09-26T10:00:00Z',
          cutoff_at: '2026-09-26T10:00:00Z',
        },
        source_csv_null: DATA_MIGRATION_NULL,
        id_mapping: 'deterministic-uuidv7-v1',
        relationships: {
          file: 'indicator-relationships.json',
          rows: 0,
          bytes: 1,
          sha256: 'a'.repeat(64),
        },
        tables: Object.fromEntries(
          DATA_MIGRATION_TABLES.map((t) => [
            t,
            {
              upserts: { file: `${t}.csv.gz`, rows: 0, bytes: 1, sha256: 'a'.repeat(64) },
              deletes: {
                file: `${t}.deletes.csv.gz`,
                rows: deletes[t] ? 1 : 0,
                bytes: 1,
                sha256: 'b'.repeat(64),
              },
            },
          ]),
        ),
      });

      await expect(
        sql.begin((tx) => applyDataMigration(tx, testDir, manifest, '1'.repeat(64))),
      ).rejects.toThrow(
        '1 publisher links or age ranges belong to indicator versions the source no longer holds',
      );

      await sql`DELETE FROM indicator_version_link WHERE indicator_version_id = ${versionId}`;
      await sql.begin((tx) => applyDataMigration(tx, testDir, manifest, '1'.repeat(64)));

      const [left] = await sql<{ count: number }[]>`
        SELECT (SELECT count(*) FROM indicator WHERE id = ${indicatorId})
          + (SELECT count(*) FROM indicator_version WHERE id = ${versionId})
          + (SELECT count(*) FROM indicator_version_topic WHERE indicator_version_id = ${versionId})
          + (SELECT count(*) FROM indicator_version_classification
             WHERE indicator_version_id = ${versionId})
          + (SELECT count(*) FROM indicator_version_source WHERE indicator_version_id = ${versionId})
          AS count
      `;
      expect(Number(left?.count)).toBe(0);
    } finally {
      await rm(testDir, { recursive: true });
    }
  });
});
