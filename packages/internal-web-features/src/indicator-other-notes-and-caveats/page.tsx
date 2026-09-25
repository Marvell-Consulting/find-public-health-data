import {
  type OtherNotesAndCaveatsField,
  otherNotesAndCaveatsSection,
} from '@fphd/internal-api-features/contract';
import { firstRadioId } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import { YesNoQuestion } from '../yes-no-question.tsx';

const QUESTIONS = [
  {
    answer: 'disclosureControl',
    detail: 'disclosureControlDetail',
    legend: 'Has disclosure control been applied?',
    moreOptions: [{ value: 'not-applicable', label: 'Not applicable' }],
  },
  { answer: 'roundingApplied', detail: 'roundingDetail', legend: 'Has any rounding been applied?' },
  { answer: 'caveatsNeeded', detail: 'caveatsDetail', legend: 'Are there any caveats needed?' },
  {
    answer: 'otherNotesNeeded',
    detail: 'otherNotesDetail',
    legend: 'Are there any other notes needed?',
  },
] as const;

export function OtherNotesAndCaveatsPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<OtherNotesAndCaveatsField>) {
  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={Object.fromEntries(QUESTIONS.map(({ answer }) => [answer, firstRadioId(answer)]))}
      fields={otherNotesAndCaveatsSection.fields.options}
      title="Provide any other notes and caveats"
    >
      {QUESTIONS.map((question) => (
        <YesNoQuestion
          key={question.answer}
          {...question}
          detailLabel="Provide details"
          detailRows={2}
          fieldErrors={fieldErrors}
          values={values}
        />
      ))}
    </IndicatorSectionForm>
  );
}
