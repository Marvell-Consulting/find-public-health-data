import { z } from '@fphd/config/zod';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  yesNoSchema,
} from './indicator-section-contract.ts';

const fields = z.enum([
  'ciMethodJustification',
  'dataSourcesJustification',
  'inequalitiesIncluded',
  'hasExclusions',
  'exclusionsDetail',
  'automationUsed',
  'automationDetail',
]);

export type JustificationsField = z.infer<typeof fields>;

export const justificationsQuestions = [
  {
    answer: 'hasExclusions',
    detail: 'exclusionsDetail',
    detailRequired: 'Enter why exclusions were made',
  },
  {
    answer: 'automationUsed',
    detail: 'automationDetail',
    detailRequired: 'Enter details of the tools used',
  },
] as const satisfies readonly DetailedQuestion<JustificationsField>[];

const schema = requireDetails(
  z.object({
    ciMethodJustification: z
      .string()
      .trim()
      .min(1, 'Enter why the confidence interval method was chosen'),
    dataSourcesJustification: z.string().trim().min(1, 'Enter why the data sources were chosen'),
    inequalitiesIncluded: z
      .string()
      .trim()
      .min(1, 'Enter what health inequalities have been included'),
    hasExclusions: yesNoSchema('Select whether there have been any exclusions'),
    exclusionsDetail: z.string().trim(),
    automationUsed: yesNoSchema('Select whether internal automation tools have been used'),
    automationDetail: z.string().trim(),
  }),
  justificationsQuestions,
);

export type Justifications = z.infer<typeof schema>;

/** Notes for reviewers on why the indicator was built as it was. */
export const justificationsSection: IndicatorSection<JustificationsField, Justifications> = {
  key: 'justifications',
  fields,
  schema,
};
