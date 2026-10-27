import { describe, expect, it } from 'vitest';

import {
  countIsNumerator,
  standardisationOf,
  UNIT_IDS,
  unitLabel,
  VALUE_TYPE_IDS,
} from './value-type-and-unit.ts';

const COUNT = '01a0d8a5-3ca2-7315-bfca-96c7324d4347';
const PER_100000 = { id: '01a0d8a5-3ca2-7315-bfca-96daa0c93ee9', name: 'per 100,000' };

describe('unitLabel', () => {
  it('names a unit in the list by its name', () => {
    expect(unitLabel(PER_100000, null)).toBe('per 100,000');
  });

  it('names an other unit as its publisher did', () => {
    expect(unitLabel({ id: UNIT_IDS.other, name: 'Other' }, 'per 1,000 live births')).toBe(
      'per 1,000 live births',
    );
  });

  it('gives no unit to values that have none', () => {
    expect(unitLabel({ id: UNIT_IDS.noUnit, name: 'No unit' }, null)).toBeNull();
  });
});

describe('standardisationOf', () => {
  it.each([
    ['a directly standardised rate', VALUE_TYPE_IDS.directlyStandardisedRate, 'direct'],
    [
      'an indirectly standardised proportion',
      VALUE_TYPE_IDS.indirectlyStandardisedProportion,
      'indirect',
    ],
    ['an indirectly standardised ratio', VALUE_TYPE_IDS.indirectlyStandardisedRatio, 'indirect'],
    ['any other value type', '01a0d8a5-3ca2-7315-bfca-96c8c77cad18', null],
  ])('reads %s as %s', (_, id, standardisation) => {
    expect(standardisationOf(id)).toBe(standardisation);
  });

  it('reads no standardisation from no value type', () => {
    expect(standardisationOf('')).toBeNull();
  });
});

describe('countIsNumerator', () => {
  it("reads a proportion's Fingertips count as its numerator", () => {
    expect(countIsNumerator(VALUE_TYPE_IDS.proportion, 241)).toBe(true);
  });

  it('keeps the count of a count', () => {
    expect(countIsNumerator(COUNT, 93014)).toBe(false);
  });

  it('keeps the count of an indicator with no value type', () => {
    expect(countIsNumerator(null, 241)).toBe(false);
  });

  it('keeps the estimated count of a survey proportion', () => {
    expect(countIsNumerator(VALUE_TYPE_IDS.proportion, 92443)).toBe(false);
  });
});
