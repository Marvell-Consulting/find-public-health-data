import {
  ENTER_POPULATION,
  type ValueTypeAndUnitOptions,
  type ValueTypeAndUnitsField,
  valueTypeAndUnitsSection,
} from '@fphd/internal-api-features/contract';
import { fieldInputId, firstRadioId, Radios, Select, TextInput } from '@fphd/ui';
import {
  INDIRECTLY_STANDARDISED_VALUE_TYPE_IDS,
  STANDARD_POPULATION_LABELS,
  STANDARD_POPULATIONS,
  standardisationOf,
  UNIT_IDS,
  VALUE_TYPE_IDS,
} from '@fphd/utils/value-type-and-unit';
import { useEffect, useState } from 'react';

import { errorProp } from '../error-prop.ts';
import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

const VALUE_TYPE_AND_UNITS_TITLE = 'What are the value type and units used in this indicator?';

/** The value type or unit in its select, which may be ahead of state before hydration. */
function selected(field: ValueTypeAndUnitsField): string | undefined {
  const select = document.getElementById(fieldInputId(field));
  return select instanceof HTMLSelectElement ? select.value : undefined;
}

type ValueTypeAndUnitsPageProps = SectionPageProps<ValueTypeAndUnitsField> &
  ValueTypeAndUnitOptions;

const listWithOr = new Intl.ListFormat('en-GB', { type: 'disjunction' });

/** The names of the offered options among these ids, listed for a hint. */
function namesOf(options: ValueTypeAndUnitOptions['valueTypes'], ids: readonly string[]): string {
  return listWithOr.format(options.filter(({ id }) => ids.includes(id)).map(({ name }) => name));
}

function selectOptions(options: ValueTypeAndUnitOptions['valueTypes']) {
  return [
    { label: 'Select', value: '' },
    ...options.map(({ id, name }) => ({ label: name, value: id })),
  ];
}

/**
 * A select cannot reveal anything without JavaScript, so until the page is hydrated every
 * follow-up shows, hinted with the choice it is for; after, only the chosen ones' show.
 */
export function ValueTypeAndUnitsPage({
  fieldErrors = {},
  formError,
  units,
  values,
  valueTypes,
}: ValueTypeAndUnitsPageProps) {
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

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{ standardPopulation: firstRadioId('standardPopulation') }}
      fields={valueTypeAndUnitsSection.fields.options}
      title={VALUE_TYPE_AND_UNITS_TITLE}
    >
      <Select
        {...errorProp(fieldErrors.valueTypeId)}
        defaultValue={values.valueTypeId}
        label="Select value type"
        name="valueTypeId"
        onChange={(event) => setValueTypeId(event.target.value)}
        options={selectOptions(valueTypes)}
      />
      <div hidden={hides(standardisation === 'direct')}>
        <Radios
          {...hint(
            `Only needed for ${namesOf(valueTypes, [VALUE_TYPE_IDS.directlyStandardisedRate])}`,
          )}
          {...errorProp(fieldErrors.standardPopulation)}
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
                      {...hint('Only needed for Other standard populations')}
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
            `Only needed for ${namesOf(valueTypes, INDIRECTLY_STANDARDISED_VALUE_TYPE_IDS)}`,
          )}
          defaultValue={values.referencePopulation}
          error={fieldErrors.referencePopulation}
          label={ENTER_POPULATION}
          name="referencePopulation"
        />
      </div>
      <Select
        {...errorProp(fieldErrors.unitId)}
        defaultValue={values.unitId}
        label="Select units"
        name="unitId"
        onChange={(event) => setUnitId(event.target.value)}
        options={selectOptions(units)}
      />
      <div hidden={hides(unitId === UNIT_IDS.other)}>
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
