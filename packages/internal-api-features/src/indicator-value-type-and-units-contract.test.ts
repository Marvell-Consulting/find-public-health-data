import { UNITS, VALUE_TYPES } from '@fphd/utils/value-type-and-unit';
import { describe, expect, it } from 'vitest';

import {
  ENTER_POPULATION,
  SELECT_STANDARD_POPULATION,
  valueTypeAndUnitsSection as section,
} from './indicator-value-type-and-units-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const DSR = VALUE_TYPES.directlyStandardisedRate.id;

const empty = {
  valueTypeId: '',
  standardPopulation: '',
  standardPopulationOther: '',
  referencePopulation: '',
  unitId: '',
  unitOther: '',
};

describe('valueTypeAndUnitsSection', () => {
  it('takes the typed answers without their surrounding spaces', () => {
    expect(
      section.schema.parse({
        ...empty,
        valueTypeId: DSR,
        standardPopulation: 'other',
        standardPopulationOther: ' England 2021\n',
        unitId: UNITS.other.id,
        unitOther: '\tpeople ',
      }),
    ).toEqual({
      ...empty,
      valueTypeId: DSR,
      standardPopulation: 'other',
      standardPopulationOther: 'England 2021',
      unitId: UNITS.other.id,
      unitOther: 'people',
    });
  });

  it.each([
    ['a value type and unit that ask nothing more', VALUE_TYPES.count.id, UNITS.noUnit.id],
    ['a unit in the list beside any value type', VALUE_TYPES.proportion.id, UNITS.percent.id],
  ])('accepts %s', (_, valueTypeId, unitId) => {
    expect(sectionFieldErrors(section, { ...empty, valueTypeId, unitId })).toBeUndefined();
  });

  it('accepts the 2013 European Standard Population beside a directly standardised rate', () => {
    expect(
      sectionFieldErrors(section, {
        ...empty,
        valueTypeId: DSR,
        standardPopulation: 'esp-2013',
        unitId: UNITS.per100000.id,
      }),
    ).toBeUndefined();
  });

  it('asks nothing of a follow-up its value type or unit does not show', () => {
    expect(
      sectionFieldErrors(section, {
        ...empty,
        valueTypeId: VALUE_TYPES.crudeRate.id,
        standardPopulation: 'other',
        unitId: UNITS.per1000.id,
        unitOther: 'x'.repeat(101),
      }),
    ).toBeUndefined();
  });

  it.each([
    [
      'an empty form, as the prototype does',
      empty,
      { valueTypeId: 'Select the value type', unitId: 'Select the units' },
    ],
    [
      'a directly standardised rate with no standard population, beside no unit',
      { ...empty, valueTypeId: DSR },
      { standardPopulation: SELECT_STANDARD_POPULATION, unitId: 'Select the units' },
    ],
    [
      'an other standard population it does not name',
      { ...empty, valueTypeId: DSR, standardPopulation: 'other', standardPopulationOther: ' ' },
      { standardPopulationOther: ENTER_POPULATION, unitId: 'Select the units' },
    ],
    [
      'an indirectly standardised value type with no reference population',
      {
        ...empty,
        valueTypeId: VALUE_TYPES.indirectlyStandardisedProportion.id,
        unitId: UNITS.percent.id,
      },
      { referencePopulation: ENTER_POPULATION },
    ],
    [
      'an other unit it does not name, beside no value type',
      { ...empty, unitId: UNITS.other.id },
      { valueTypeId: 'Select the value type', unitOther: 'Enter the unit' },
    ],
    [
      'an other unit over 100 characters',
      {
        ...empty,
        valueTypeId: VALUE_TYPES.count.id,
        unitId: UNITS.other.id,
        unitOther: 'x'.repeat(101),
      },
      { unitOther: 'Unit must be 100 characters or fewer' },
    ],
    [
      'a value type and unit it does not offer',
      { ...empty, valueTypeId: '00000000-0000-7000-8000-000000000999', unitId: 'per week' },
      { valueTypeId: 'Select the value type', unitId: 'Select the units' },
    ],
    [
      'a standard population it does not offer',
      { ...empty, valueTypeId: DSR, standardPopulation: '1976', unitId: UNITS.per100000.id },
      { standardPopulation: SELECT_STANDARD_POPULATION },
    ],
  ])('refuses %s', (_, body, fieldErrors) => {
    expect(sectionFieldErrors(section, body)).toEqual(fieldErrors);
  });

  it('takes an other unit of exactly 100 characters', () => {
    expect(
      sectionFieldErrors(section, {
        ...empty,
        valueTypeId: VALUE_TYPES.count.id,
        unitId: UNITS.other.id,
        unitOther: 'x'.repeat(100),
      }),
    ).toBeUndefined();
  });

  it.each([{}, { ...empty, unitOther: 1 }])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});
