import { type PolarityField, polaritySection } from '@fphd/internal-api-features/contract';
import { firstRadioId, Radios } from '@fphd/ui';
import { POLARITIES, POLARITY_LABELS } from '@fphd/utils/polarity';

import {
  IndicatorSectionForm,
  QUESTION_HEADING_SIZE,
  type SectionPageProps,
} from '../indicator-section-form.tsx';

const POLARITY_QUESTION = 'What is the polarity of this indicator?';

// The question is the page's h1, inside the legend.
export function PolarityPage(form: SectionPageProps<PolarityField>) {
  const { fieldErrors, values } = form;

  return (
    <IndicatorSectionForm
      form={form}
      fieldIds={{ polarity: firstRadioId('polarity') }}
      section={polaritySection}
      questionIsHeading
      title={POLARITY_QUESTION}
    >
      <Radios
        defaultValue={values.polarity}
        error={fieldErrors.polarity}
        label={POLARITY_QUESTION}
        labelClassModifiers={QUESTION_HEADING_SIZE}
        labelHeading="h1"
        name="polarity"
        options={POLARITIES.map((value) => ({ label: POLARITY_LABELS[value], value }))}
      />
    </IndicatorSectionForm>
  );
}
