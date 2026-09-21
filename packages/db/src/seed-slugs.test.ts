import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { isReservedSlug, SLUG_PATTERN, slugify, slugProblem } from '@fphd/config/slug';
import { describe, expect, it } from 'vitest';

/**
 * The seed arrives by COPY, so its slugs are derived in the Python export rather than by
 * the application. Checking the committed CSV against the TypeScript rule here is what
 * stops the two implementations drifting apart.
 */
const seedDir = fileURLToPath(new URL('../data/seed/', import.meta.url));

/** Enough of RFC 4180 for the export's writer: quoted fields and doubled quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function readSeedTable(table: string): Record<string, string>[] {
  const [header = [], ...rows] = parseCsv(
    gunzipSync(readFileSync(`${seedDir}${table}.csv.gz`)).toString('utf8'),
  );

  return rows.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? ''])),
  );
}

const shortIdByIndicator = new Map(
  readSeedTable('indicator').map((row) => [row.id ?? '', Number(row.short_id)]),
);

const versions = readSeedTable('indicator_version').map((row) => ({
  indicatorId: row.indicator_id ?? '',
  shortId: shortIdByIndicator.get(row.indicator_id ?? '') ?? Number.NaN,
  name: row.name ?? '',
  slug: row.slug ?? '',
}));

/** The export's rule: the lower short id keeps the bare slug, the next one is suffixed. */
function expectedSlugs(): Map<string, string> {
  const slugs = new Map<string, string>();
  const claimed = new Set<string>();

  for (const { indicatorId, shortId, name } of [...versions].sort(
    (a, b) => a.shortId - b.shortId,
  )) {
    const base = slugify(name);
    slugs.set(indicatorId, claimed.has(base) ? `${base}-${shortId}` : base);
    claimed.add(base);
  }

  return slugs;
}

describe('the committed seed', () => {
  it('has a version for every indicator, so the checks below cover them all', () => {
    expect(versions).toHaveLength(shortIdByIndicator.size);
    expect(versions.every(({ shortId }) => Number.isInteger(shortId))).toBe(true);
  });

  it('carries the slug the TypeScript rule derives from each name', () => {
    const expected = expectedSlugs();

    expect(new Map(versions.map(({ indicatorId, slug }) => [indicatorId, slug]))).toEqual(expected);
  });

  it('names every indicator in a way the slug rule accepts', () => {
    expect(versions.filter(({ name }) => slugProblem(name) !== undefined)).toEqual([]);
  });

  it('carries no slug that is reserved, digits only or otherwise unusable', () => {
    for (const { slug } of versions) {
      expect(slug).toMatch(SLUG_PATTERN);
      expect(/^\d+$/.test(slug)).toBe(false);
      expect(isReservedSlug(slug)).toBe(false);
    }
  });

  it('gives no slug to two indicators', () => {
    expect(new Set(versions.map(({ slug }) => slug)).size).toBe(versions.length);
  });
});
