import { z } from '@fphd/config/zod';
import {
  STANDARD_POPULATIONS,
  standardisationOf,
  UNIT_IDS,
  UNIT_OTHER_MAX_LENGTH,
} from '@fphd/utils/value-type-and-unit';

import type { IndicatorSection } from './indicator-section-contract.ts';

const optionSchema = z.object({ id: z.uuid(), name: z.string().min(1) });

/** Every value type and unit a publisher may choose, each in the order the form lists them. */
export const valueTypeAndUnitOptionsSchema = z.object({
  valueTypes: z.array(optionSchema),
  units: z.array(optionSchema),
});

export type ValueTypeAndUnitOptions = z.infer<typeof valueTypeAndUnitOptionsSchema>;

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

export const SELECT_VALUE_TYPE = 'Select the value type';
export const SELECT_UNITS = 'Select the units';
export const SELECT_STANDARD_POPULATION = 'Select the standard population used';
export const ENTER_POPULATION =
  'Enter the standard or reference population used for the standardisation calculation';

/**
 * The follow-ups are required only beside the value type or unit that asks them. The form
 * judges that a value type and unit are chosen; the API also checks that it offers them.
 */
const schema = z
  .object({
    valueTypeId: z.uuid(SELECT_VALUE_TYPE),
    standardPopulation: z.enum(['', ...STANDARD_POPULATIONS], {
      error: SELECT_STANDARD_POPULATION,
    }),
    standardPopulationOther: z.string().trim(),
    referencePopulation: z.string().trim(),
    unitId: z.uuid(SELECT_UNITS),
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
      if (answers.unitId === UNIT_IDS.other && answers.unitOther === '') {
        issue('unitOther', 'Enter the unit');
      }
      if (answers.unitId === UNIT_IDS.other && answers.unitOther.length > UNIT_OTHER_MAX_LENGTH) {
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
