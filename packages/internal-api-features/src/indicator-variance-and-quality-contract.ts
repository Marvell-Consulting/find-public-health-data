import { z } from '@fphd/config/zod';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  textSection,
  yesNoSchema,
} from './indicator-section-contract.ts';
import { longText } from './text-contract.ts';

const fields = z.enum([
  'variation',
  'qualityAssurance',
  'hasSourceDataIssues',
  'sourceDataIssuesDetail',
]);

export type VarianceAndQualityField = z.infer<typeof fields>;

export const varianceAndQualityQuestions = [
  {
    answer: 'hasSourceDataIssues',
    detail: 'sourceDataIssuesDetail',
    detailRequired: 'Enter details of the data quality issues with the source data',
  },
] as const satisfies readonly DetailedQuestion<VarianceAndQualityField>[];

const schema = requireDetails(
  z.object({
    variation: longText('Variation').min(1, 'Enter how the indicator varies'),
    qualityAssurance: longText('Quality assurance').min(
      1,
      'Enter what quality assurance has been done on the indicator',
    ),
    hasSourceDataIssues: yesNoSchema(
      'Select whether there are any data quality issues with the source data',
    ),
    sourceDataIssuesDetail: longText('Details of the source data quality issues'),
  }),
  varianceAndQualityQuestions,
);

export type VarianceAndQuality = z.infer<typeof schema>;

/** Notes for reviewers on how the indicator varies and how its quality was checked. */
export const varianceAndQualitySection: IndicatorSection<
  VarianceAndQualityField,
  VarianceAndQuality
> = textSection({ key: 'variance-and-quality', fields, schema });
