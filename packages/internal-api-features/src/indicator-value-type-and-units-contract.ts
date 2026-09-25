import { z } from '@fphd/config/zod';
import {
  STANDARD_POPULATIONS,
  standardisationOf,
  UNIT_OTHER_MAX_LENGTH,
  UNITS,
  VALUE_TYPES,
} from '@fphd/utils/value-type-and-unit';

import type { IndicatorSection } from './indicator-section-contract.ts';

// The directly standardised rate's other population and the indirectly standardised value
// types' reference population are one answer, asked in two places so each shows without JavaScript.
const fields = z.enum([
  'valueTypeId',
  'standardPopulation',
  'standardPopulationOther',
  'referencePopulation',
  'unitId',
  'unitOther',
]);

type Ids = [string, ...string[]];

const VALUE_TYPE_IDS = Object.values(VALUE_TYPES).map(({ id }) => id) as Ids;
const UNIT_IDS = Object.values(UNITS).map(({ id }) => id) as Ids;

export const SELECT_STANDARD_POPULATION = 'Select the standard population used';
export const ENTER_POPULATION =
  'Enter the standard or reference population used for the standardisation calculation';

/** The follow-ups are required only beside the value type or unit that asks them. */
const schema = z
  .object({
    valueTypeId: z.enum(VALUE_TYPE_IDS, { error: 'Select the value type' }),
    standardPopulation: z.enum(['', ...STANDARD_POPULATIONS], {
      error: SELECT_STANDARD_POPULATION,
    }),
    standardPopulationOther: z.string().trim(),
    referencePopulation: z.string().trim(),
    unitId: z.enum(UNIT_IDS, { error: 'Select the units' }),
    unitOther: z.string().trim(),
  })
  .superRefine(
    (answers, ctx) => {
      const issue = (field: z.infer<typeof fields>, message: string) =>
        ctx.addIssue({ code: 'custom', path: [field], message });
      const standardisation = standardisationOf(answers.valueTypeId);

      if (standardisation === 'direct' && answers.standardPopulation === '') {
        issue('standardPopulation', SELECT_STANDARD_POPULATION);
      }
      if (
        standardisation === 'direct' &&
        answers.standardPopulation === 'other' &&
        answers.standardPopulationOther === ''
      ) {
        issue('standardPopulationOther', ENTER_POPULATION);
      }
      if (standardisation === 'indirect' && answers.referencePopulation === '') {
        issue('referencePopulation', ENTER_POPULATION);
      }
      if (answers.unitId === UNITS.other.id && answers.unitOther === '') {
        issue('unitOther', 'Enter the unit');
      }
      if (answers.unitId === UNITS.other.id && answers.unitOther.length > UNIT_OTHER_MAX_LENGTH) {
        issue('unitOther', `Unit must be ${UNIT_OTHER_MAX_LENGTH} characters or fewer`);
      }
    },
    // Also beside an unanswered value type or unit, so every refusal shows at once.
    {
      when: ({ issues }) =>
        issues.every(({ path }) => path?.[0] === 'valueTypeId' || path?.[0] === 'unitId'),
    },
  );

export type ValueTypeAndUnitsField = z.infer<typeof fields>;
export type ValueTypeAndUnits = z.infer<typeof schema>;

export const valueTypeAndUnitsSection: IndicatorSection<ValueTypeAndUnitsField, ValueTypeAndUnits> =
  { key: 'value-type-and-units', fields, schema };
