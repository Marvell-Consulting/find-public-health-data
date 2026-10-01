import { type DataQualityField, dataQualitySection } from '@fphd/internal-api-features/contract';
import { errorProp, firstRadioId, Radios } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

const DATA_QUALITY_QUESTION = 'Are there any data quality issues with this indicator?';

// The question is the page's h1, inside the legend, where NotGovUK sizes it.
export function DataQualityPage(form: SectionPageProps<DataQualityField>) {
  const { fieldErrors, values } = form;

  return (
    <IndicatorSectionForm
      form={form}
      fieldIds={{ hasDataQualityIssues: firstRadioId('hasDataQualityIssues') }}
      section={dataQualitySection}
      questionIsHeading
      title={DATA_QUALITY_QUESTION}
    >
      <Radios
        {...errorProp(fieldErrors.hasDataQualityIssues)}
        defaultValue={values.hasDataQualityIssues}
        hint="If yes, you should ensure these issues are clearly explained in the 'Caveats' section."
        label={<h1>{DATA_QUALITY_QUESTION}</h1>}
        name="hasDataQualityIssues"
        options={[
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
      />
    </IndicatorSectionForm>
  );
}
