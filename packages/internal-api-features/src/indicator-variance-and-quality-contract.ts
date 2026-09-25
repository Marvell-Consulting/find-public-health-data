import { z } from '@fphd/config/zod';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  yesNoSchema,
} from './indicator-section-contract.ts';

const fields = z.enum([
  'variation',
  'qualityAssurance',
  'sourceDataIssues',
  'sourceDataIssuesDetail',
]);

export type VarianceAndQualityField = z.infer<typeof fields>;

export const varianceAndQualityQuestions = [
  {
    answer: 'sourceDataIssues',
    detail: 'sourceDataIssuesDetail',
    detailRequired: 'Enter details of the data quality issues with the source data',
  },
] as const satisfies readonly DetailedQuestion<VarianceAndQualityField>[];

const schema = requireDetails(
  z.object({
    variation: z.string().trim().min(1, 'Enter how the indicator varies'),
    qualityAssurance: z
      .string()
      .trim()
      .min(1, 'Enter what quality assurance has been done on the indicator'),
    sourceDataIssues: yesNoSchema(
      'Select whether there are any data quality issues with the source data',
    ),
    sourceDataIssuesDetail: z.string().trim(),
  }),
  varianceAndQualityQuestions,
);

export type VarianceAndQuality = z.infer<typeof schema>;

/** Notes for reviewers on how the indicator varies and how its quality was checked. */
export const varianceAndQualitySection: IndicatorSection<
  VarianceAndQualityField,
  VarianceAndQuality
> = { key: 'variance-and-quality', fields, schema };
