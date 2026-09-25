import {
  type OtherCommentsField,
  otherCommentsSection,
} from '@fphd/internal-api-features/contract';
import { firstRadioId, Textarea } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import { YesNoQuestion } from '../yes-no-question.tsx';

export function OtherCommentsPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<OtherCommentsField>) {
  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{ hasReviewerComments: firstRadioId('hasReviewerComments') }}
      fields={otherCommentsSection.fields.options}
      title="Other comments"
    >
      <Textarea
        defaultValue={values.sponsorsAndStakeholders}
        error={fieldErrors.sponsorsAndStakeholders}
        label="Enter any applicable sponsors or stakeholders for this indicator (optional)"
        name="sponsorsAndStakeholders"
        rows={5}
      />
      <YesNoQuestion
        answer="hasReviewerComments"
        detail="reviewerCommentsDetail"
        detailLabel="Enter comments"
        detailRows={5}
        fieldErrors={fieldErrors}
        legend="Are there any other comments for the reviewers?"
        values={values}
      />
    </IndicatorSectionForm>
  );
}
