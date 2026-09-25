import {
  type CopyrightAndDataReuseField,
  copyrightAndDataReuseSection,
} from '@fphd/internal-api-features/contract';
import { firstRadioId } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import { YesNoQuestion } from '../yes-no-question.tsx';

const QUESTIONS = [
  {
    answer: 'copyrightNonDefault',
    detail: 'copyrightDetail',
    legend: 'Is the copyright different to the default?',
    hint: 'The default is "© Crown copyright"',
  },
  {
    answer: 'dataReuseNonDefault',
    detail: 'dataReuseDetail',
    legend: 'Is the data re-use different to the default?',
    hint: 'The default is "The data may be used referencing Office for Health Improvement and Disparities"',
  },
] as const;

export function CopyrightAndDataReusePage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<CopyrightAndDataReuseField>) {
  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{
        copyrightNonDefault: firstRadioId('copyrightNonDefault'),
        dataReuseNonDefault: firstRadioId('dataReuseNonDefault'),
      }}
      fields={copyrightAndDataReuseSection.fields.options}
      title="Copyright and data re-use"
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
