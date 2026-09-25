import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseClassificationsFile } from './classification-core-data.ts';
import type { ClassificationRecord } from './schema/index.ts';

const outcome: ClassificationRecord = {
  dimension: 'indicator_type',
  slug: 'indicator-type-outcome',
  name: 'Outcome',
};
const alcohol: ClassificationRecord = {
  dimension: 'risk_factor',
  slug: 'risk-factor-alcohol',
  name: 'Alcohol',
};

const committedFile = fileURLToPath(new URL('../data/classifications.json', import.meta.url));

describe('parseClassificationsFile', () => {
  it('accepts a well-formed file', () => {
    expect(parseClassificationsFile([outcome, alcohol])).toEqual([outcome, alcohol]);
  });

  it('rejects a dimension the schema does not know', () => {
    expect(() => parseClassificationsFile([{ ...outcome, dimension: 'mood' }])).toThrow(/Invalid/);
  });

  it('rejects a slug that is not lowercase hyphenated words', () => {
    expect(() => parseClassificationsFile([{ ...outcome, slug: 'Outcome' }])).toThrow(/Invalid/);
  });

  it('rejects a repeated slug, or a name repeated within a dimension', () => {
    expect(() => parseClassificationsFile([outcome, { ...alcohol, slug: outcome.slug }])).toThrow(
      /duplicate slug/,
    );
    expect(() =>
      parseClassificationsFile([outcome, { ...outcome, slug: 'indicator-type-outcome-2' }]),
    ).toThrow(/duplicate name/);
  });

  it('accepts the same name in two dimensions', () => {
    const alcoholFramework = {
      ...alcohol,
      slug: 'framework-alcohol',
      dimension: 'framework' as const,
    };

    expect(parseClassificationsFile([alcohol, alcoholFramework])).toHaveLength(2);
  });

  it('accepts the committed file', () => {
    expect(() =>
      parseClassificationsFile(JSON.parse(readFileSync(committedFile, 'utf-8'))),
    ).not.toThrow();
  });
});
