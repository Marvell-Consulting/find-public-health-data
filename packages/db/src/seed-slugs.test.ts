import { isReservedSlug, SLUG_PATTERN, slugify, slugProblem } from '@fphd/utils/slug';
import { describe, expect, it } from 'vitest';

import { readSeedTable } from './seed-csv.testing.ts';

/**
 * The seed arrives by COPY, so its slugs are derived in the Python export rather than by
 * the application. Checking the committed CSV against the TypeScript rule here is what
 * stops the two implementations drifting apart.
 */
const shortIdByIndicator = new Map(
  readSeedTable('indicator').map((row) => [row.id ?? '', Number(row.short_id)]),
);

const versions = readSeedTable('indicator_version').map((row) => ({
  indicatorId: row.indicator_id ?? '',
  shortId: shortIdByIndicator.get(row.indicator_id ?? '') ?? Number.NaN,
  name: row.name ?? '',
  slug: row.slug ?? '',
}));

/** The export's rule: the slug is the name's, and a collision stops the export. */
function expectedSlugs(): Map<string, string> {
  return new Map(versions.map(({ indicatorId, name }) => [indicatorId, slugify(name)]));
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
