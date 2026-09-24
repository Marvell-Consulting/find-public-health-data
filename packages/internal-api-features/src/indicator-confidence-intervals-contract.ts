import { z } from '@fphd/config/zod';

import type { IndicatorSection } from './indicator-section-contract.ts';

/**
 * What choosing a method asks of the publisher next: whether a standard method was modified,
 * the detail of an other method, or nothing for a method with none to describe.
 */
export const ciMethodKindSchema = z.enum(['standard', 'other', 'none']);

export const ciMethodSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  /** The method's standard description, which not every method has yet. */
  description: z.string().nullable(),
  kind: ciMethodKindSchema,
});

/** Every method a publisher may choose, in the order the form lists them. */
export const ciMethodListSchema = z.array(ciMethodSchema);

export type CiMethodKind = z.infer<typeof ciMethodKindSchema>;
export type CiMethod = z.infer<typeof ciMethodSchema>;

const fields = z.enum([
  'ciMethodId',
  'ciMethodModified',
  'ciMethodModifications',
  'ciMethodOtherDetail',
]);

export const SELECT_CI_METHOD = 'Select the confidence interval method used';

/**
 * What the form can judge alone: that a method is chosen. Which of the other answers are
 * required depends on the method's kind, which only the API reads, so it judges them.
 */
const schema = z.object({
  ciMethodId: z.uuid(SELECT_CI_METHOD),
  ciMethodModified: z.enum(['', 'yes', 'no'], 'Select whether any modifications were used'),
  ciMethodModifications: z.string().trim(),
  ciMethodOtherDetail: z.string().trim(),
});

export type ConfidenceIntervalsField = z.infer<typeof fields>;
export type ConfidenceIntervals = z.infer<typeof schema>;

export const confidenceIntervalsSection: IndicatorSection<
  ConfidenceIntervalsField,
  ConfidenceIntervals
> = { key: 'confidence-intervals', fields, schema };
