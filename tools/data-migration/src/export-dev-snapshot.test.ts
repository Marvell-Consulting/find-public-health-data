import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { verifyPublishedSnapshot } from '../../../apps/operations/src/published-snapshot.ts';
import { readGzipCsv } from './csv.ts';
import { writeDevelopmentSource } from './export-dev-snapshot.testing.ts';
import { exportDevSnapshot } from './export-dev-snapshot.ts';
import { exportPholio } from './pholio/export-pholio.ts';

vi.mock('./pholio/export-pholio.ts', () => ({ exportPholio: vi.fn() }));
let directory: string;
afterEach(async () => {
  vi.resetAllMocks();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('builds an archive accepted by the receiver using the real tidy and rekey pipeline', async () => {
  directory = await mkdtemp(join(tmpdir(), 'dev-snapshot-'));
  vi.mocked(exportPholio).mockImplementation(({ outDir }) => writeDevelopmentSource(outDir));
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
