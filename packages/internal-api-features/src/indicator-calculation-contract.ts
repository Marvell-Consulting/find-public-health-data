import { z } from '@fphd/config/zod';
import { INDICATOR_CALCULATED_BY } from '@fphd/utils/calculated-by';

import { type IndicatorSection, textSection } from './indicator-section-contract.ts';

const fields = z.enum(['methodology', 'calculatedBy', 'calculatedByDetail']);

const calculatedBySchema = z.enum(INDICATOR_CALCULATED_BY, {
  error: 'Select who calculated the indicator',
});

// The details are asked for only under "Other", so only then are they required.
const schema = z
  .object({
    methodology: z.string().trim().min(1, 'Enter the methodology'),
    calculatedBy: calculatedBySchema,
    calculatedByDetail: z.string().trim(),
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
