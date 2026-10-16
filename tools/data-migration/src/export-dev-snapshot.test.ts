import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DATA_MIGRATION_NULL } from '@fphd/db/data-migration-contract';
import { afterEach, expect, it, vi } from 'vitest';
import { verifyPublishedSnapshot } from '../../../apps/operations/src/published-snapshot.ts';
import { readGzipCsv } from './csv.ts';
import { exportDevSnapshot } from './export-dev-snapshot.ts';
import { exportPholio } from './pholio/export-pholio.ts';
import { TableWriter } from './pholio/table-writer.ts';
import { TABLES } from './tables.ts';

vi.mock('./pholio/export-pholio.ts', () => ({ exportPholio: vi.fn() }));
let directory: string;
afterEach(async () => {
  vi.resetAllMocks();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('builds an archive accepted by the receiver using the real tidy and rekey pipeline', async () => {
  directory = await mkdtemp(join(tmpdir(), 'dev-snapshot-'));
  vi.mocked(exportPholio).mockImplementation(async ({ outDir }) => {
    await mkdir(outDir, { recursive: true });
    const tables: Record<string, unknown> = {};
    for (const table of TABLES) {
      const writer = new TableWriter(outDir, table);
      if (table === 'indicator' || table === 'indicator_version') {
        for (let id = 1; id <= 1325; id++)
          await writer.write({
            id,
            ...(table === 'indicator_version'
              ? { indicator_id: id, name: `Indicator ${id}`, status: 'published' }
              : {}),
          });
      } else
        await writer.write({
          id: 1,
          ...(table === 'observation' ? { dimension_key: '' } : {}),
          ...(table === 'dimension_type'
            ? { name: ' Sex ', dimension_class: 'core', is_required: true }
            : {}),
          ...(table === 'dimension_value'
            ? { dimension_type_id: 1, name: ' Female ', is_aggregate: false }
            : {}),
          ...(table === 'note_type' ? { text: ' Suppressed ', category: 'disclosure' } : {}),
        });
      tables[table] = await writer.close();
    }
    // One eligible observation; the excluded indicators hold the remaining source observations.
    await writeFile(
      join(outDir, 'source-manifest.json'),
      JSON.stringify({
        exported_indicators: 1325,
        excluded_observations: 29656328,
        source_csv_null: DATA_MIGRATION_NULL,
        tables,
      }),
    );
  });
  await exportDevSnapshot({ connectionString: 'test source', outDir: directory });
  const manifest = await verifyPublishedSnapshot(directory);
  expect(manifest.tables.indicator?.rows).toBe(1325);
  expect(manifest.reference_names).toBe('tidied');
  const source = JSON.parse(await readFile(join(directory, 'source-manifest.json'), 'utf8'));
  expect(source.reference_names).toBe('tidied');
  const values = [];
  for await (const row of readGzipCsv(join(directory, 'dimension_value.csv.gz'))) values.push(row);
  expect(values[1]?.[values[0]?.indexOf('name') ?? -1]).toBe('Female');
  expect((await stat(join(directory, 'snapshot.tar'))).size).toBeGreaterThan(0);
});
