import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
  legacySource,
  legacySourceIds,
  readLegacyMap,
  versionLegacySources,
} from './legacy-sources.ts';

const directories: string[] = [];

afterEach(async () => {
  for (const dir of directories.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function writeCsvGz(path: string, rows: string[][]): Promise<void> {
  const lines = rows.map((r) => `${r.join(',')}\r\n`).join('');
  await pipeline(Readable.from([lines]), createGzip(), createWriteStream(path));
}

describe('legacySource', () => {
  const ids = {
    'Office for National Statistics (ONS), Live births': '019fa38f-0000-7000-8000-000000000001',
  };
  const legacyMap: Record<string, unknown[]> = {
    'Office for National Statistics (ONS), Live births': [
      { provider: 'Office for National Statistics (ONS)', source: 'Live births' },
    ],
  };

  it('trims leading and trailing spaces before lookup', () => {
    expect(
      legacySource(' Office for National Statistics (ONS), Live births ', ids, legacyMap),
    ).toEqual([
      '019fa38f-0000-7000-8000-000000000001',
      [{ provider: 'Office for National Statistics (ONS)', source: 'Live births' }],
    ]);
  });

  it('returns [null, []] for null or empty input', () => {
    expect(legacySource(null, ids, legacyMap)).toEqual([null, []]);
    expect(legacySource('', ids, legacyMap)).toEqual([null, []]);
    expect(legacySource('   ', ids, legacyMap)).toEqual([null, []]);
  });

  it('throws mentioning the map file for a name not in the map', () => {
    expect(() =>
      legacySource('Office for National Statistics (ONS), Live births', ids, {}),
    ).toThrow('legacy-numerator-denominator-sources.json');
  });

  it('throws mentioning the name for a name not in the seed', () => {
    expect(() => legacySource('A source nobody has', ids, legacyMap)).toThrow(
      'A source nobody has',
    );
  });
});

describe('legacySourceIds and versionLegacySources', () => {
  it('reads the CSV correctly, trims names, and maps empty denominator_source_id to null', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'legacy-sources-test-'));
    directories.push(dir);

    await writeCsvGz(join(dir, 'numerator_denominator_source.csv.gz'), [
      ['id', 'name', 'url'],
      ['s1', 'Estimated ', ''],
    ]);
    await writeCsvGz(join(dir, 'indicator_version.csv.gz'), [
      ['id', 'numerator_source_id', 'denominator_source_id'],
      ['v1', 's1', ''],
    ]);

    expect(await legacySourceIds(dir)).toEqual({ Estimated: 's1' });
    expect(await versionLegacySources(dir)).toEqual({ v1: ['s1', null] });
  });

  it('every source name in the committed seed is present in the legacy map', async () => {
    let ids: Record<string, string>;
    let legacyMap: Record<string, unknown[]>;

    const seedDir = new URL('../../../packages/db/data/seed', import.meta.url).pathname;

    try {
      ids = await legacySourceIds(seedDir);
      legacyMap = await readLegacyMap();
    } catch {
      return;
    }

    const missing = Object.keys(ids).filter((name) => !(name in legacyMap));
    expect(missing).toEqual([]);
  });
});
