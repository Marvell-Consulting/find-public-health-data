import { z } from '@fphd/config/zod';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  textSection,
  yesNoSchema,
} from './indicator-section-contract.ts';
import { longText } from './text-contract.ts';

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
    sponsorsAndStakeholders: longText('Sponsors or stakeholders'),
    hasReviewerComments: yesNoSchema('Select whether you have additional comments'),
    reviewerCommentsDetail: longText('Comments'),
  }),
  otherCommentsQuestions,
);

export type OtherComments = z.infer<typeof schema>;

/** Notes for reviewers: who sponsors the indicator, and anything else they should know. */
export const otherCommentsSection: IndicatorSection<OtherCommentsField, OtherComments> =
  textSection({ key: 'other-comments', fields, schema });
