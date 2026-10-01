import { z } from '@fphd/config/zod';
import { INDICATOR_CALCULATED_BY } from '@fphd/utils/calculated-by';

import { type IndicatorSection, textSection } from './indicator-section-contract.ts';
import { longText } from './text-contract.ts';

const fields = z.enum(['methodology', 'calculatedBy', 'calculatedByDetail']);

const calculatedBySchema = z.enum(INDICATOR_CALCULATED_BY, {
  error: 'Select who calculated the indicator',
});

// The details are asked for only under "Other", so only then are they required.
const schema = z
  .object({
    methodology: longText('Methodology').min(1, 'Enter the methodology'),
    calculatedBy: calculatedBySchema,
    calculatedByDetail: longText('Details of the other organisation or organisations'),
  })
  .superRefine(({ calculatedBy, calculatedByDetail }, ctx) => {
    if (calculatedBy === 'other' && calculatedByDetail === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['calculatedByDetail'],
        message: 'Enter details of the other organisation or organisations',
      });
    }
  });

export type CalculationField = z.infer<typeof fields>;
export type Calculation = z.infer<typeof schema>;

export const calculationSection: IndicatorSection<CalculationField, Calculation> = textSection({
  key: 'calculation',
  fields,
  schema,
});
