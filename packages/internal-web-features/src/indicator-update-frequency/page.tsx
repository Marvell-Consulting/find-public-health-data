import {
  type UpdateFrequencyField,
  updateFrequencySection,
} from '@fphd/internal-api-features/contract';
import { errorProp, firstRadioId, Radios } from '@fphd/ui';
import {
  UPDATE_FREQUENCIES,
  UPDATE_FREQUENCY_LABELS,
  type UpdateFrequency,
} from '@fphd/utils/update-frequency';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

const UPDATE_FREQUENCY_QUESTION = 'How often will this indicator be updated?';

function option(value: UpdateFrequency) {
  return { label: UPDATE_FREQUENCY_LABELS[value], value };
}

// "No longer updated" is not a frequency, so it follows the others after an "or" divider.
const OPTIONS = [
  ...UPDATE_FREQUENCIES.filter((value) => value !== 'no-longer-updated').map(option),
  'or',
  option('no-longer-updated'),
];

// The question is the page's h1, inside the legend, where NotGovUK sizes it.
export function UpdateFrequencyPage(form: SectionPageProps<UpdateFrequencyField>) {
  const { fieldErrors, values } = form;

  return (
    <IndicatorSectionForm
      form={form}
      fieldIds={{ updateFrequency: firstRadioId('updateFrequency') }}
      section={updateFrequencySection}
      questionIsHeading
      title={UPDATE_FREQUENCY_QUESTION}
    >
      <Radios
        {...errorProp(fieldErrors.updateFrequency)}
        defaultValue={values.updateFrequency}
        label={<h1>{UPDATE_FREQUENCY_QUESTION}</h1>}
        name="updateFrequency"
        options={OPTIONS}
      />
    </IndicatorSectionForm>
  );
}
