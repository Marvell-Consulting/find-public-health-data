import { type PolarityField, polaritySection } from '@fphd/internal-api-features/contract';
import { firstRadioId, Radios } from '@fphd/ui';
import { POLARITIES, POLARITY_LABELS } from '@fphd/utils/polarity';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

const POLARITY_QUESTION = 'What is the polarity of this indicator?';

// The question is the page's h1, inside the legend, where NotGovUK sizes it.
export function PolarityPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<PolarityField>) {
  const error = fieldErrors.polarity;

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{ polarity: firstRadioId('polarity') }}
      fields={polaritySection.fields.options}
      questionIsHeading
      title={POLARITY_QUESTION}
    >
      <Radios
        {...(error === undefined ? {} : { error })}
        defaultValue={values.polarity}
        label={<h1>{POLARITY_QUESTION}</h1>}
        name="polarity"
        options={POLARITIES.map((value) => ({ label: POLARITY_LABELS[value], value }))}
      />
    </IndicatorSectionForm>
  );
}
