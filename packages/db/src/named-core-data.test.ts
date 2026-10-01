import { readFileSync } from 'node:fs';

import { UNIT_IDS, VALUE_TYPE_IDS } from '@fphd/utils/value-type-and-unit';
import { describe, expect, it } from 'vitest';

import { type NamedRecord, parseNamedRecordsFile } from './named-core-data.ts';

const count: NamedRecord = { id: '01a0d8a5-3ca2-7315-bfca-96c7324d4347', name: 'Count' };
const mean: NamedRecord = { id: '01a0d8a5-3ca2-7315-bfca-96cff286704d', name: 'Mean' };

function committed(file: string): unknown {
  return JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf-8'));
}

const valueTypes = parseNamedRecordsFile('value types', committed('value-types.json'));
const units = parseNamedRecordsFile('units', committed('units.json'));

// Every Pholio value type and unit, with the service value each translates to.
const PHOLIO = committed('../src/pholio-value-types-and-units.json') as {
  valueTypes: { service: string }[];
  units: { service: string }[];
};

describe('parseNamedRecordsFile', () => {
  it('accepts a well-formed file', () => {
    expect(parseNamedRecordsFile('value types', [count, mean])).toEqual([count, mean]);
  });

  it('rejects an id that is not UUIDv7 or a blank name', () => {
    expect(() =>
      parseNamedRecordsFile('units', [{ ...count, id: '8b7e4a52-9c1d-4f6e-8a3b-2d5c9e7f1a04' }]),
    ).toThrow(/Invalid units file/);
    expect(() => parseNamedRecordsFile('units', [{ ...count, name: ' ' }])).toThrow(/Invalid/);
  });

  it('rejects a repeated id or name', () => {
    expect(() => parseNamedRecordsFile('units', [count, { ...count, name: 'Mean' }])).toThrow(
      /duplicate id/,
    );
    expect(() => parseNamedRecordsFile('units', [count, { ...mean, name: 'Count' }])).toThrow(
      /duplicate name/,
    );
  });

  it('accepts the committed files', () => {
    expect(() =>
      parseNamedRecordsFile('comparator methods', committed('comparator-methods.json')),
    ).not.toThrow();
    expect(valueTypes.length).toBeGreaterThan(0);
    expect(units.length).toBeGreaterThan(0);
  });
});

describe('the committed value types and units', () => {
  it('hold every value type and unit the code behaves on', () => {
    expect(valueTypes.map(({ id }) => id)).toEqual(
      expect.arrayContaining(Object.values(VALUE_TYPE_IDS)),
    );
    expect(units.map(({ id }) => id)).toEqual(expect.arrayContaining(Object.values(UNIT_IDS)));
  });

  it('name every value type and unit the Pholio translation gives', () => {
    const names = (records: NamedRecord[]) => records.map(({ name }) => name);

    expect(names(valueTypes)).toEqual(
      expect.arrayContaining(PHOLIO.valueTypes.map(({ service }) => service)),
    );
    expect(names(units)).toEqual(
      expect.arrayContaining(PHOLIO.units.map(({ service }) => service)),
    );
  });
});
