import { type CalculationField, calculationSection } from '@fphd/internal-api-features/contract';
import { firstRadioId, Radios, Textarea } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

export function CalculationPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<CalculationField>) {
  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{ calculatedBy: firstRadioId('calculatedBy') }}
      fields={calculationSection.fields.options}
      title="How was the indicator calculated?"
    >
      <Textarea
        defaultValue={values.methodology}
        error={fieldErrors.methodology}
        label="Enter methodology"
        name="methodology"
        rows={5}
      />
      <Radios
        {...(fieldErrors.calculatedBy === undefined ? {} : { error: fieldErrors.calculatedBy })}
        defaultValue={values.calculatedBy}
        // NotGovUK sizes a heading in a legend; a bare h2 would be large, the class makes it medium.
        label={<h2 className="govuk-heading-m">Who calculated the indicator?</h2>}
        name="calculatedBy"
        options={[
          { value: 'ohid', label: 'Office for Health Improvement and Disparities' },
          { value: 'dhsc', label: 'Department of Health and Social Care' },
          {
            value: 'other',
            label: 'Other organisation or organisations',
            // Shown without JavaScript; with it, only while "Other" is chosen.
            conditional: (
              <Textarea
                defaultValue={values.calculatedByOther}
                error={fieldErrors.calculatedByOther}
                label="Enter details of the other organisation or organisations"
                name="calculatedByOther"
                rows={3}
              />
            ),
          },
        ]}
      />
    </IndicatorSectionForm>
  );
}
