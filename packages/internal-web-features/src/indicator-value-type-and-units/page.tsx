import {
  ENTER_POPULATION,
  type ValueTypeAndUnitsField,
  valueTypeAndUnitsSection,
} from '@fphd/internal-api-features/contract';
import { fieldInputId, firstRadioId, Radios, Select, TextInput } from '@fphd/ui';
import {
  STANDARD_POPULATION_LABELS,
  STANDARD_POPULATIONS,
  standardisationOf,
  UNITS,
  VALUE_TYPES,
} from '@fphd/utils/value-type-and-unit';
import { useEffect, useState } from 'react';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

export const VALUE_TYPE_AND_UNITS_TITLE =
  'What are the value type and units used in this indicator?';

/** The value type or unit in its select, which may be ahead of state before hydration. */
function selected(field: ValueTypeAndUnitsField): string | undefined {
  const select = document.getElementById(fieldInputId(field));
  return select instanceof HTMLSelectElement ? select.value : undefined;
}

/**
 * A select cannot reveal anything without JavaScript, so until the page is hydrated every
 * follow-up shows, hinted with the choice it is for; after, only the chosen ones' show.
 */
export function ValueTypeAndUnitsPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<ValueTypeAndUnitsField>) {
  const [valueTypeId, setValueTypeId] = useState(values.valueTypeId);
  const [unitId, setUnitId] = useState(values.unitId);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    setValueTypeId((current) => selected('valueTypeId') ?? current);
    setUnitId((current) => selected('unitId') ?? current);
    setEnhanced(true);
  }, []);

  const standardisation = standardisationOf(valueTypeId);
  const hint = (text: string) => (enhanced ? {} : { hint: text });
  const hides = (shown: boolean) => enhanced && !shown;
  // Select and Radios take no undefined error.
  const errorOf = (field: ValueTypeAndUnitsField) => {
    const error = fieldErrors[field];
    return error === undefined ? {} : { error };
  };

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{ standardPopulation: firstRadioId('standardPopulation') }}
      fields={valueTypeAndUnitsSection.fields.options}
      title={VALUE_TYPE_AND_UNITS_TITLE}
    >
      <Select
        {...errorOf('valueTypeId')}
        defaultValue={values.valueTypeId}
        label="Select value type"
        name="valueTypeId"
        onChange={(event) => setValueTypeId(event.target.value)}
        options={[
          { label: 'Select', value: '' },
          ...Object.values(VALUE_TYPES).map(({ id, name }) => ({ label: name, value: id })),
        ]}
      />
      <div hidden={hides(standardisation === 'direct')}>
        <Radios
          {...hint(`Only needed for ${VALUE_TYPES.directlyStandardisedRate.name}`)}
          {...errorOf('standardPopulation')}
          defaultValue={values.standardPopulation}
          // NotGovUK sizes a heading in a legend; a bare h2 would be large, the class makes it medium.
          label={<h2 className="govuk-heading-m">What standard population has been used?</h2>}
          name="standardPopulation"
          options={STANDARD_POPULATIONS.map((value) => ({
            label: STANDARD_POPULATION_LABELS[value],
            value,
            ...(value === 'other'
              ? {
                  // Shown without JavaScript; with it, only while "Other" is chosen.
                  conditional: (
                    <TextInput
                      defaultValue={values.standardPopulationOther}
                      error={fieldErrors.standardPopulationOther}
                      label={ENTER_POPULATION}
                      name="standardPopulationOther"
                    />
                  ),
                }
              : {}),
          }))}
        />
      </div>
      <div hidden={hides(standardisation === 'indirect')}>
        <TextInput
          {...hint(
            `Only needed for ${VALUE_TYPES.indirectlyStandardisedProportion.name} or ${VALUE_TYPES.indirectlyStandardisedRatio.name}`,
          )}
          defaultValue={values.referencePopulation}
          error={fieldErrors.referencePopulation}
          label={ENTER_POPULATION}
          name="referencePopulation"
        />
      </div>
      <Select
        {...errorOf('unitId')}
        defaultValue={values.unitId}
        label="Select units"
        name="unitId"
        onChange={(event) => setUnitId(event.target.value)}
        options={[
          { label: 'Select', value: '' },
          ...Object.values(UNITS).map(({ id, name }) => ({ label: name, value: id })),
        ]}
      />
      <div hidden={hides(unitId === UNITS.other.id)}>
        <TextInput
          {...hint('Only needed for Other units')}
          className="govuk-input--width-20"
          defaultValue={values.unitOther}
          error={fieldErrors.unitOther}
          label="Enter unit"
          name="unitOther"
        />
      </div>
    </IndicatorSectionForm>
  );
}
