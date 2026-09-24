import { z } from '@fphd/config/zod';

import type { IndicatorSection } from './indicator-section-contract.ts';

const fields = z.enum(['methodology', 'calculatedBy', 'calculatedByOther']);

const calculatedBySchema = z.enum(['ohid', 'dhsc', 'other'], {
  error: 'Select who calculated the indicator',
});

// The details are asked for only under "Other", so only then are they required.
const schema = z
  .object({
    methodology: z.string().trim().min(1, 'Enter the methodology'),
    calculatedBy: calculatedBySchema,
    calculatedByOther: z.string().trim(),
  })
  .superRefine(({ calculatedBy, calculatedByOther }, ctx) => {
    if (calculatedBy === 'other' && calculatedByOther === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['calculatedByOther'],
        message: 'Enter details of the other organisation or organisations',
      });
    }
  });

export type CalculationField = z.infer<typeof fields>;
export type Calculation = z.infer<typeof schema>;

export const calculationSection: IndicatorSection<CalculationField, Calculation> = {
  key: 'calculation',
  fields,
  schema,
};
