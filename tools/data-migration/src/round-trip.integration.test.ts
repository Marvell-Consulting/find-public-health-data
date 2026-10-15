import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  baselineManifestSchema,
  DATA_MIGRATION_NULL,
  dataMigrationManifestSchema,
} from '@fphd/db/data-migration-contract';
import {
  applyDataMigration,
  createOwnerClient,
  importCoreData,
  rebuildReadModels,
} from '@fphd/db/operations';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import type postgres from 'postgres';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { createIncremental } from './diff.ts';
import { sha256 } from './files.ts';
import { type ExportRow, TableWriter } from './pholio/table-writer.ts';
import { deterministicUuid, prepareBaseline } from './prepare-baseline.ts';
import { TABLES } from './tables.ts';
import { verifyPackageFiles } from './verify.ts';

let database: TestDatabase;
let sql: postgres.Sql;
let directory: string;
let topicId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  const core = createOwnerClient(database.name);
  try {
    await importCoreData(core);
  } finally {
    await core.end();
  }
  sql = createOwnerClient(database.name);
  const [topic] = await sql<{ id: string }[]>`SELECT id FROM topic ORDER BY id LIMIT 1`;
  if (!topic) throw new Error('Core topics are missing');
  topicId = topic.id;
  directory = await mkdtemp(join(tmpdir(), 'fphd-exporter-round-trip-'));
});

afterAll(async () => {
  await sql?.end();
  await database?.drop();
  if (directory) await rm(directory, { recursive: true });
});

async function snapshot(id: string, cutoff: string, observations: ExportRow[], withdrawn = false) {
  const out = join(directory, id);
  await mkdir(out);
  const enteredAt = '2026-01-01T00:00:00Z';
  const rows: Partial<Record<(typeof TABLES)[number], ExportRow[]>> = {
    dimension_type: [{ id: 1, name: 'Sex', dimension_class: 'core', is_required: false }],
    dimension_value: [
      { id: 1, dimension_type_id: 1, name: 'Female', sort_order: 0, is_aggregate: false },
    ],
    area_type: [{ id: 1, name: 'LA unchanged', hierarchy_type: 'Administrative', level: 1 }],
    area: [
      { id: 1, code: 'E92000001', name: 'England', area_type_id: 1, valid_from: '2010-01-01' },
    ],
    indicator: [{ id: 108, created_at: enteredAt }],
    indicator_version: [
      {
        id: 108,
        indicator_id: 108,
        status: 'published',
        published_at: enteredAt,
        name: 'Round trip indicator',
        upload_batch_id: 108,
        data_table_confirmed_at: enteredAt,
        created_at: enteredAt,
        updated_at: enteredAt,
        created_by: 'pholio-migration',
        updated_by: 'pholio-migration',
      },
    ],
    upload_batch: [
      {
        id: 108,
        indicator_id: 108,
        indicator_version_id: 108,
        original_filename: 'pholio-migration',
        uploaded_by: 'migration',
        uploaded_at: enteredAt,
        status: 'processed',
      },
    ],
    observation: observations.map((row) => ({
      indicator_id: 108,
      area_id: 1,
      upload_batch_id: 108,
      dimension_key: '1',
      created_at: enteredAt,
      created_by: 'migration',
      ...row,
    })),
    observation_dimension: observations.map((row) => ({
      id: Number(row.id) * 4,
      observation_id: row.id,
      dimension_value_id: 1,
      dimension_type_id: 1,
    })),
  };
  if (withdrawn) {
    rows.indicator = [];
    rows.indicator_version = [];
    rows.upload_batch = [];
  }
  rows.indicator?.push({ id: 109, created_at: enteredAt });
  rows.indicator_version?.push({
    id: 109,
    indicator_id: 109,
    status: 'published',
    published_at: enteredAt,
    name: 'Retained indicator',
    upload_batch_id: null,
    data_table_confirmed_at: null,
    created_at: enteredAt,
    updated_at: enteredAt,
    created_by: 'pholio-migration',
    updated_by: 'pholio-migration',
  });
  const tables: Record<string, Awaited<ReturnType<TableWriter['close']>>> = {};
  for (const table of TABLES) {
    const writer = new TableWriter(out, table);
    await writer.writeAll(rows[table] ?? []);
    tables[table] = await writer.close();
  }
  await writeFile(
    join(out, 'source-manifest.json'),
    JSON.stringify({
      source: {
        system: 'fingertips',
        environment: 'live',
        database: 'pholio',
        snapshot_at: cutoff,
        cutoff_at: cutoff,
      },
      approved_indicators: withdrawn ? 1 : 2,
      excluded_non_approved_indicators: 0,
      excluded_future_observations: 0,
      source_csv_null: DATA_MIGRATION_NULL,
      tables,
    }),
  );
  const relationships = join(out, 'reviewed.json');
  await writeFile(
    relationships,
    JSON.stringify({
      approval: {
        approvedBy: 'round trip fixture',
        approvedAt: cutoff,
        basis: 'reviewed test mapping',
      },
      indicators: withdrawn ? [109] : [108, 109],
      indicatorTopics: [
        ...(withdrawn ? [] : [{ fingertipsId: 108, topicId }]),
        { fingertipsId: 109, topicId },
      ],
    }),
  );
  await prepareBaseline(out, id, relationships);
  return out;
}

async function apply(out: string) {
  const manifest = dataMigrationManifestSchema.parse(
    JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8')),
  );
  await verifyPackageFiles(out, manifest);
  const digest = await sha256(join(out, 'manifest.json'));
  await sql.begin(async (tx) => {
    await applyDataMigration(tx, out, manifest, digest);
  });
  await rebuildReadModels(sql);
}

it('imports prepared baseline, corrections and withdrawal with resolved batch links', async () => {
  const first = await snapshot('baseline-1', '2026-10-01T00:00:00Z', [
    { id: 2, from_date: '2025-01-01', to_date: '2025-12-31', value: 10 },
    { id: 4, from_date: '2026-01-01', to_date: '2026-12-31', value: 11 },
  ]);
  await apply(first);
  const [version] = await sql<{ batch: string; confirmed: boolean; owner: string }[]>`
    SELECT v.upload_batch_id AS batch, v.data_table_confirmed_at IS NOT NULL AS confirmed,
      b.indicator_version_id AS owner
    FROM indicator_version v JOIN upload_batch b ON b.id = v.upload_batch_id
  `;
  expect(version).toEqual({
    batch: deterministicUuid('upload_batch', '108'),
    confirmed: true,
    owner: deterministicUuid('indicator_version', '108'),
  });
  expect(await sql`SELECT value, dimension_key FROM observation ORDER BY id`).toEqual([
    { value: 10, dimension_key: deterministicUuid('dimension_value', '1') },
    { value: 11, dimension_key: deterministicUuid('dimension_value', '1') },
  ]);
  expect((await sql`SELECT id FROM published.observation`).length).toBe(2);

  const current = await snapshot('increment-2', '2026-11-01T00:00:00Z', [
    { id: 2, from_date: '2025-01-01', to_date: '2025-12-31', value: 20 },
    { id: 6, from_date: '2027-01-01', to_date: '2027-12-31', value: 30 },
  ]);
  const increment = join(directory, 'increment');
  await createIncremental(first, current, increment, 'increment-2');
  await apply(increment);
  expect(
    (await sql`SELECT value FROM published.observation ORDER BY id`).map((row) => row.value),
  ).toEqual([20, 30]);
  expect((await sql`SELECT * FROM data_migration`).length).toBe(2);
  const manifest = baselineManifestSchema.parse(
    JSON.parse(await readFile(join(current, 'manifest.json'), 'utf8')),
  );
  expect(manifest.tables.observation?.rows).toBe(2);

  const withdrawn = await snapshot('increment-3', '2026-12-01T00:00:00Z', [], true);
  const withdrawal = join(directory, 'withdrawal');
  await createIncremental(current, withdrawn, withdrawal, 'increment-3');
  await apply(withdrawal);
  for (const table of ['upload_batch', 'observation', 'observation_dimension', 'latest_headline']) {
    expect(await sql.unsafe(`SELECT count(*)::int AS count FROM ${table}`)).toEqual([{ count: 0 }]);
  }
  expect(await sql`SELECT short_id FROM published.indicator`).toEqual([{ short_id: 109 }]);
  expect(await sql`SELECT count(*)::int AS count FROM indicator_version_topic`).toEqual([
    { count: 1 },
  ]);
  expect(await sql`SELECT id FROM published.observation`).toEqual([]);
  expect((await sql`SELECT id FROM data_migration`).length).toBe(3);
});
