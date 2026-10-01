import { UNIT_IDS, VALUE_TYPE_IDS } from '@fphd/utils/value-type-and-unit';
import { describe, expect, it } from 'vitest';

import {
  ENTER_POPULATION,
  SELECT_STANDARD_POPULATION,
  valueTypeAndUnitsSection as section,
} from './indicator-value-type-and-units-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const DSR = VALUE_TYPE_IDS.directlyStandardisedRate;

const empty = {
  valueTypeId: '',
  standardPopulation: '',
  standardPopulationOther: '',
  referencePopulation: '',
  unitId: '',
  unitDetail: '',
};

describe('valueTypeAndUnitsSection', () => {
  it('takes the typed answers without their surrounding spaces', () => {
    expect(
      section.schema.parse({
        ...empty,
        valueTypeId: DSR,
        standardPopulation: 'other',
        standardPopulationOther: ' England 2021\n',
        unitId: UNIT_IDS.other,
        unitDetail: '\tpeople ',
      }),
    ).toEqual({
      ...empty,
      valueTypeId: DSR,
      standardPopulation: 'other',
      standardPopulationOther: 'England 2021',
      unitId: UNIT_IDS.other,
      unitDetail: 'people',
    });
  });

  it.each([
    [
      'a value type and unit that ask nothing more',
      '01a0d8a5-3ca2-7315-bfca-96c7324d4347',
      UNIT_IDS.noUnit,
    ],
    [
      'a unit in the list beside any value type',
      '01a0d8a5-3ca2-7315-bfca-96d2031a65e7',
      '01a0d8a5-3ca2-7315-bfca-96d615820bd4',
    ],
  ])('accepts %s', (_, valueTypeId, unitId) => {
    expect(sectionFieldErrors(section, { ...empty, valueTypeId, unitId })).toBeUndefined();
  });

  it('accepts the 2013 European Standard Population beside a directly standardised rate', () => {
    expect(
      sectionFieldErrors(section, {
        ...empty,
        valueTypeId: DSR,
        standardPopulation: 'esp-2013',
        unitId: '01a0d8a5-3ca2-7315-bfca-96daa0c93ee9',
      }),
    ).toBeUndefined();
  });

  it('asks nothing of a follow-up its value type or unit does not show', () => {
    expect(
      sectionFieldErrors(section, {
        ...empty,
        valueTypeId: '01a0d8a5-3ca2-7315-bfca-96c8c77cad18',
        standardPopulation: 'other',
        unitId: '01a0d8a5-3ca2-7315-bfca-96d8d8d7aec2',
        unitDetail: 'x'.repeat(101),
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
        valueTypeId: VALUE_TYPE_IDS.indirectlyStandardisedProportion,
        unitId: '01a0d8a5-3ca2-7315-bfca-96d615820bd4',
      },
      { referencePopulation: ENTER_POPULATION },
    ],
    [
      'an other unit it does not name, beside no value type',
      { ...empty, unitId: UNIT_IDS.other },
      { valueTypeId: 'Select the value type', unitDetail: 'Enter the unit' },
    ],
    [
      'an other unit over 100 characters',
      {
        ...empty,
        valueTypeId: '01a0d8a5-3ca2-7315-bfca-96c7324d4347',
        unitId: UNIT_IDS.other,
        unitDetail: 'x'.repeat(101),
      },
      { unitDetail: 'Unit must be 100 characters or fewer' },
    ],
    [
      'a value type and unit that are not ids',
      { ...empty, valueTypeId: 'Crude rate', unitId: 'per week' },
      { valueTypeId: 'Select the value type', unitId: 'Select the units' },
    ],
    [
      'a standard population it does not offer',
      {
        ...empty,
        valueTypeId: DSR,
        standardPopulation: '1976',
        unitId: '01a0d8a5-3ca2-7315-bfca-96daa0c93ee9',
      },
      { standardPopulation: SELECT_STANDARD_POPULATION },
    ],
  ])('refuses %s', (_, body, fieldErrors) => {
    expect(sectionFieldErrors(section, body)).toEqual(fieldErrors);
  });

  it('takes an other unit of exactly 100 characters', () => {
    expect(
      sectionFieldErrors(section, {
        ...empty,
        valueTypeId: '01a0d8a5-3ca2-7315-bfca-96c7324d4347',
        unitId: UNIT_IDS.other,
        unitDetail: 'x'.repeat(100),
      }),
    ).toBeUndefined();
  });

  it.each([{}, { ...empty, unitDetail: 1 }])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});
