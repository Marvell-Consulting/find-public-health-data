import { describe, expect, it } from 'vitest';

import { standardisationOf, UNITS, unitLabel, VALUE_TYPES } from './value-type-and-unit.ts';

describe('unitLabel', () => {
  it('names a unit in the list by its name', () => {
    expect(unitLabel(UNITS.per100000, null)).toBe('per 100,000');
  });

  it('names an other unit as its publisher did', () => {
    expect(unitLabel(UNITS.other, 'per 1,000 live births')).toBe('per 1,000 live births');
  });

  it('gives no unit to values that have none', () => {
    expect(unitLabel(UNITS.noUnit, null)).toBeNull();
  });
});

describe('standardisationOf', () => {
  it.each([
    [VALUE_TYPES.directlyStandardisedRate, 'direct'],
    [VALUE_TYPES.indirectlyStandardisedProportion, 'indirect'],
    [VALUE_TYPES.indirectlyStandardisedRatio, 'indirect'],
    [VALUE_TYPES.crudeRate, null],
  ])('reads $name as $1', ({ id }, standardisation) => {
    expect(standardisationOf(id)).toBe(standardisation);
  });

  it('reads no standardisation from no value type', () => {
    expect(standardisationOf('')).toBeNull();
  });
});
