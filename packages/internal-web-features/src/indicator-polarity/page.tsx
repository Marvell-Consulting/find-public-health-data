import { polaritySection } from '@fphd/internal-api-features/contract';
import { firstRadioId, Radios } from '@fphd/ui';
import { POLARITIES, POLARITY_LABELS } from '@fphd/utils/polarity';

import type { FormFailure, FormValues } from '../indicator-section.ts';
import { IndicatorSectionForm } from '../indicator-section-form.tsx';
import type { PolarityField } from './loader.ts';

const POLARITY_QUESTION = 'What is the polarity of this indicator?';

interface PolarityPageProps {
  fieldErrors?: FormFailure<PolarityField>['fieldErrors'] | undefined;
  values: FormValues<PolarityField>;
}

// The question is the page's h1, inside the legend, where NotGovUK sizes it.
export function PolarityPage({ fieldErrors = {}, values }: PolarityPageProps) {
  const error = fieldErrors.polarity;

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
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
