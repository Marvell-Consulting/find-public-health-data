import { z } from '@fphd/config/zod';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  yesNoSchema,
} from './indicator-section-contract.ts';

const fields = z.enum(['sponsorsAndStakeholders', 'hasReviewerComments', 'reviewerCommentsDetail']);

export type OtherCommentsField = z.infer<typeof fields>;

export const otherCommentsQuestions = [
  {
    answer: 'hasReviewerComments',
    detail: 'reviewerCommentsDetail',
    detailRequired: 'Enter your comments',
  },
] as const satisfies readonly DetailedQuestion<OtherCommentsField>[];

const schema = requireDetails(
  z.object({
    // Optional: not every indicator has a sponsor or stakeholder to name.
    sponsorsAndStakeholders: z.string().trim(),
    hasReviewerComments: yesNoSchema('Select whether you have additional comments'),
    reviewerCommentsDetail: z.string().trim(),
  }),
  otherCommentsQuestions,
);

export type OtherComments = z.infer<typeof schema>;

/** Notes for reviewers: who sponsors the indicator, and anything else they should know. */
export const otherCommentsSection: IndicatorSection<OtherCommentsField, OtherComments> = {
  key: 'other-comments',
  fields,
  schema,
};
