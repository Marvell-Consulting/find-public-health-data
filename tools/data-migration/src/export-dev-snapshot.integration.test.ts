import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createOwnerClient,
  importCoreData,
  rebuildReadModels,
  seedPublishedTables,
} from '@fphd/db/operations';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import type postgres from 'postgres';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { verifyPublishedSnapshot } from '../../../apps/operations/src/published-snapshot.ts';
import { sourceConfirmation, writeDevelopmentSource } from './export-dev-snapshot.testing.ts';
import { exportDevSnapshot } from './export-dev-snapshot.ts';
import { exportPholio } from './pholio/export-pholio.ts';
import { deterministicUuid } from './prepare-baseline.ts';

vi.mock('./pholio/export-pholio.ts', () => ({ exportPholio: vi.fn() }));
let database: TestDatabase;
let sql: postgres.Sql;
let directory: string;
beforeAll(async () => {
  database = await createTestDatabase();
  sql = createOwnerClient(database.name);
  await importCoreData(sql);
  directory = await mkdtemp(join(tmpdir(), 'dev-snapshot-import-'));
});
afterAll(async () => {
  await sql?.end();
  await database?.drop();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('imports a generated development snapshot with version batch pointers and published observations', async () => {
  vi.mocked(exportPholio).mockImplementation(({ outDir }) => writeDevelopmentSource(outDir));
  await exportDevSnapshot({ connectionString: 'test source', outDir: directory });
  const manifest = await verifyPublishedSnapshot(directory);
  const imported = await sql.begin((tx) => seedPublishedTables(tx, directory));
  for (const [table, record] of Object.entries(manifest.tables))
    expect(imported.tables[table], table).toBe(record.rows);
  await rebuildReadModels(sql);
  const versionId = deterministicUuid('indicator_version', '108');
  const batchId = deterministicUuid('upload_batch', '108');
  const [version] = await sql<{ batch: string; confirmed: Date; owner: string }[]>`
    SELECT v.upload_batch_id AS batch, v.data_table_confirmed_at AS confirmed,
      b.indicator_version_id AS owner
    FROM indicator_version v JOIN upload_batch b ON b.id=v.upload_batch_id
    WHERE v.id=${versionId}
  `;
  expect(version).toEqual({
    batch: batchId,
    confirmed: new Date(sourceConfirmation),
    owner: versionId,
  });
  expect(
    await sql`
    SELECT p.value, o.upload_batch_id
    FROM published.observation p JOIN observation o ON o.id = p.id
  `,
  ).toEqual([{ value: 10, upload_batch_id: batchId }]);
  expect(await sql`SELECT count(*)::int AS count FROM published.observation_dimension`).toEqual([
    { count: 1 },
  ]);
  expect(await sql`SELECT count(*)::int AS count FROM published.observation_note`).toEqual([
    { count: 1 },
  ]);
});
