import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { parseDataProvidersFile } from './data-provider-core-data.ts';
import { parseLegacySourceMap, readLegacySourceMap } from './legacy-sources.ts';

const read = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** The names in the seed's Fingertips source list, as the loader matches them. */
function seedSourceNames(): string[] {
  const csv = gunzipSync(readFileSync(read('../data/seed/numerator_denominator_source.csv.gz')))
    .toString('utf-8')
    .trim()
    .split('\n')
    .slice(1);

  // id,name,url, where a name holding a comma is quoted.
  return csv.map((line) => {
    const name = line.slice(line.indexOf(',') + 1, line.lastIndexOf(','));
    return (name.startsWith('"') ? name.slice(1, -1).replaceAll('""', '"') : name).trim();
  });
}

describe('parseLegacySourceMap', () => {
  it('accepts a name mapped to providers, with or without a source, or to none', () => {
    const map = {
      'Office for National Statistics (ONS), Live births': [
        { provider: 'Office for National Statistics (ONS)', source: 'Live births' },
      ],
      'Not applicable (N/A)': [],
    };

    expect(parseLegacySourceMap(map)).toEqual(map);
  });

  it('rejects a name that maps to one pair twice', () => {
    const pair = { provider: 'Estimated', source: null };

    expect(() => parseLegacySourceMap({ Estimated: [pair, pair] })).toThrow(/repeats/);
  });
});

describe('the committed legacy source map', () => {
  const map = readLegacySourceMap();

  it("maps every source in the seed's Fingertips list", () => {
    expect(seedSourceNames().filter((name) => map[name] === undefined)).toEqual([]);
  });

  it("maps every source in Fingertips' public metadata export", () => {
    // The trimmed numerator and denominator source names of every indicator in the export.
    const names: string[] = JSON.parse(
      readFileSync(read('./fingertips-export-source-names.json'), 'utf-8'),
    );

    expect(names.filter((name) => map[name] === undefined)).toEqual([]);
  });

  it('names only providers and sources the core data holds', () => {
    const providers = parseDataProvidersFile(
      JSON.parse(readFileSync(read('../data/data-providers.json'), 'utf-8')),
    );
    const held = new Set(
      providers.flatMap(({ name, sources }) => [
        JSON.stringify([name, null]),
        ...sources.map((source) => JSON.stringify([name, source.name])),
      ]),
    );
    const unheld = Object.values(map)
      .flat()
      .map(({ provider, source }) => JSON.stringify([provider, source]))
      .filter((pair) => !held.has(pair));

    expect(unheld).toEqual([]);
  });
});
