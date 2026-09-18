import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
      rows: 1,
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
    };
  }
  await writeFile(
    join(directory, 'manifest.json'),
    JSON.stringify({
      source,
      source_database: 'fphd_new',
      approved_indicators: 1,
      id_mapping: 'deterministic-uuidv7-v1',
      tables,
    }),
  );
  return directory;
}

describe('verifyPublishedSnapshot', () => {
  it('accepts a complete published clone with matching checksums', async () => {
    const directory = await snapshot();
    await expect(verifyPublishedSnapshot(directory)).resolves.toMatchObject({
      approved_indicators: 1,
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
});
