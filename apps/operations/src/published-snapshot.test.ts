import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { SEED_TABLES } from '@fphd/db/operations';
import { afterEach, describe, expect, it } from 'vitest';

import { verifyPublishedSnapshot } from './published-snapshot.ts';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function snapshot(source = 'PHOLIO_LIVE_A-derived fphd_new benchmark clone') {
  const directory = await mkdtemp(join(tmpdir(), 'fphd-snapshot-test-'));
  directories.push(directory);
  const tables: Record<string, { rows: number; bytes: number; sha256: string }> = {};
  for (const table of SEED_TABLES) {
    const data = gzipSync('id\n1\n');
    await writeFile(join(directory, `${table}.csv.gz`), data);
    tables[table] = {
      rows: table === 'indicator' ? 1_290 : table === 'observation' ? 29_380_899 : 1,
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
    };
  }
  const sourceManifest = {
    source,
    source_database: 'fphd_new',
    approved_indicators: 1_290,
    tables,
  };
  await writeFile(join(directory, 'source-manifest.json'), JSON.stringify(sourceManifest));
  await writeFile(
    join(directory, 'manifest.json'),
    JSON.stringify({ ...sourceManifest, id_mapping: 'deterministic-uuidv7-v1' }),
  );
  return directory;
}

describe('verifyPublishedSnapshot', () => {
  it('accepts a complete published clone with matching checksums', async () => {
    const directory = await snapshot();
    await expect(verifyPublishedSnapshot(directory)).resolves.toMatchObject({
      approved_indicators: 1_290,
    });
  });

  it('rejects a staging export even when its files are intact', async () => {
    const directory = await snapshot('PHOLIO_STAGING');
    await expect(verifyPublishedSnapshot(directory)).rejects.toThrow();
  });

  it('rejects data changed after the manifest was written', async () => {
    const directory = await snapshot();
    await writeFile(join(directory, 'observation.csv.gz'), gzipSync('id\n2\n'));
    await expect(verifyPublishedSnapshot(directory)).rejects.toThrow(
      'Published snapshot checksum failed for observation',
    );
  });

  it('rejects a mislabeled archive with a different published-clone fingerprint', async () => {
    const directory = await snapshot();
    const path = join(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.tables.observation.rows -= 1;
    await writeFile(path, JSON.stringify(manifest));
    await expect(verifyPublishedSnapshot(directory)).rejects.toThrow(
      'Published snapshot row counts do not match the published benchmark clone',
    );
  });

  it('rejects a transformed manifest that disagrees with the source export', async () => {
    const directory = await snapshot();
    const path = join(directory, 'source-manifest.json');
    const sourceManifest = JSON.parse(await readFile(path, 'utf8'));
    sourceManifest.tables.area.rows += 1;
    await writeFile(path, JSON.stringify(sourceManifest));
    await expect(verifyPublishedSnapshot(directory)).rejects.toThrow(
      'Published snapshot source row count differs for area',
    );
  });
});
