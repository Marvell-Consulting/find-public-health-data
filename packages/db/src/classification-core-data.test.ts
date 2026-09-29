import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseClassificationsFile } from './classification-core-data.ts';
import { parseIndicatorTopicFile } from './indicator-topic-repository.ts';
import type { ClassificationRecord } from './schema/index.ts';

const outcome: ClassificationRecord = {
  id: '01a0edef-f609-758f-8890-c2d9a81ec617',
  dimension: 'indicator_type',
  slug: 'indicator-type-outcome',
  name: 'Outcome',
};
const alcohol: ClassificationRecord = {
  id: '01a0edef-f609-758f-8890-d4ee5defa462',
  dimension: 'risk_factor',
  slug: 'risk-factor-alcohol',
  name: 'Alcohol',
};

function data(path: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf-8'));
}

describe('parseClassificationsFile', () => {
  it('accepts a well-formed file', () => {
    expect(parseClassificationsFile([outcome, alcohol])).toEqual([outcome, alcohol]);
  });

  it('rejects a dimension the schema does not know', () => {
    expect(() => parseClassificationsFile([{ ...outcome, dimension: 'mood' }])).toThrow(/Invalid/);
  });

  it('rejects a missing id, or one that is not UUIDv7', () => {
    const { id: _, ...withoutId } = outcome;

    expect(() => parseClassificationsFile([withoutId])).toThrow(/Invalid/);
    expect(() =>
      parseClassificationsFile([{ ...outcome, id: '8b7e4a52-9c1d-4f6e-8a3b-2d5c9e7f1a04' }]),
    ).toThrow(/Invalid/);
  });

  it('rejects a slug that is not lowercase hyphenated words', () => {
    expect(() => parseClassificationsFile([{ ...outcome, slug: 'Outcome' }])).toThrow(/Invalid/);
  });

  it('rejects a repeated id or slug, or a name repeated within a dimension', () => {
    expect(() => parseClassificationsFile([outcome, { ...alcohol, id: outcome.id }])).toThrow(
      /duplicate id/,
    );
    expect(() => parseClassificationsFile([outcome, { ...alcohol, slug: outcome.slug }])).toThrow(
      /duplicate slug/,
    );
    expect(() =>
      parseClassificationsFile([
        outcome,
        { ...outcome, id: alcohol.id, slug: 'indicator-type-outcome-2' },
      ]),
    ).toThrow(/duplicate name/);
  });

  it('accepts the same name in two dimensions', () => {
    const alcoholFramework = {
      ...alcohol,
      id: '01a0edf3-9879-77a9-9f34-23cc9caa6c04',
      slug: 'framework-alcohol',
      dimension: 'framework' as const,
    };

    expect(parseClassificationsFile([alcohol, alcoholFramework])).toHaveLength(2);
  });

  it('accepts the committed file, which holds every classification the seed links to', () => {
    const ids = new Set(
      parseClassificationsFile(data('../data/classifications.json')).map(({ id }) => id),
    );
    const links = parseIndicatorTopicFile(data('../data/indicator-classifications.json'));

    expect(links.indicatorClassifications.length).toBeGreaterThan(0);
    expect(
      links.indicatorClassifications.filter(({ classificationId }) => !ids.has(classificationId)),
    ).toEqual([]);
  });
});
