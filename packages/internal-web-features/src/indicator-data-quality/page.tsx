import { type DataQualityField, dataQualitySection } from '@fphd/internal-api-features/contract';
import { firstRadioId, Radios } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

const DATA_QUALITY_QUESTION = 'Are there any data quality issues with this indicator?';

// The question is the page's h1, inside the legend, where NotGovUK sizes it.
export function DataQualityPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<DataQualityField>) {
  const error = fieldErrors.dataQualityIssues;

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{ dataQualityIssues: firstRadioId('dataQualityIssues') }}
      fields={dataQualitySection.fields.options}
      questionIsHeading
      title={DATA_QUALITY_QUESTION}
    >
      <Radios
        {...(error === undefined ? {} : { error })}
        defaultValue={values.dataQualityIssues}
        hint="If yes, you should ensure these issues are clearly explained in the 'Caveats' section."
        label={<h1>{DATA_QUALITY_QUESTION}</h1>}
        name="dataQualityIssues"
        options={[
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
      />
    </IndicatorSectionForm>
  );
}
