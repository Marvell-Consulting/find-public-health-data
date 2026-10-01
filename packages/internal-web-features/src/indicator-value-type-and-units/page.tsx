import {
  ENTER_POPULATION,
  type ValueTypeAndUnitOptions,
  type ValueTypeAndUnitsField,
  valueTypeAndUnitsSection,
} from '@fphd/internal-api-features/contract';
import { errorProp, firstRadioId, QuestionLegend, Radios, Select, TextInput } from '@fphd/ui';
import {
  INDIRECTLY_STANDARDISED_VALUE_TYPE_IDS,
  STANDARD_POPULATION_LABELS,
  STANDARD_POPULATIONS,
  standardisationOf,
  UNIT_IDS,
  VALUE_TYPE_IDS,
} from '@fphd/utils/value-type-and-unit';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import { useSelectedValue } from '../selected-value.ts';

const VALUE_TYPE_AND_UNITS_TITLE = 'What are the value type and units used in this indicator?';

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

/** Each follow-up is asked only of the value type or unit that needs it, once one is chosen. */
export function ValueTypeAndUnitsPage({ units, valueTypes, ...form }: ValueTypeAndUnitsPageProps) {
  const { fieldErrors, values } = form;
  const valueType = useSelectedValue<ValueTypeAndUnitsField>('valueTypeId', values.valueTypeId);
  const unit = useSelectedValue<ValueTypeAndUnitsField>('unitId', values.unitId);
  const standardisation = standardisationOf(valueType.value);

  return (
    <IndicatorSectionForm
      fieldIds={{ standardPopulation: firstRadioId('standardPopulation') }}
      form={form}
      section={valueTypeAndUnitsSection}
      title={VALUE_TYPE_AND_UNITS_TITLE}
    >
      <Select
        {...errorProp(fieldErrors.valueTypeId)}
        defaultValue={values.valueTypeId}
        label="Select value type"
        name="valueTypeId"
        onChange={valueType.onChange}
        options={selectOptions(valueTypes)}
      />
      <div hidden={valueType.hides(standardisation === 'direct')}>
        <Radios
          {...valueType.hint(
            `Only needed for ${namesOf(valueTypes, [VALUE_TYPE_IDS.directlyStandardisedRate])}`,
          )}
          {...errorProp(fieldErrors.standardPopulation)}
          defaultValue={values.standardPopulation}
          label={<QuestionLegend>What standard population has been used?</QuestionLegend>}
          name="standardPopulation"
          options={STANDARD_POPULATIONS.map((value) => ({
            label: STANDARD_POPULATION_LABELS[value],
            value,
            ...(value === 'other'
              ? {
                  // Shown without JavaScript; with it, only while "Other" is chosen.
                  conditional: (
                    <TextInput
                      {...valueType.hint('Only needed for Other standard populations')}
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
      <div hidden={valueType.hides(standardisation === 'indirect')}>
        <TextInput
          {...valueType.hint(
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
        onChange={unit.onChange}
        options={selectOptions(units)}
      />
      <div hidden={unit.hides(unit.value === UNIT_IDS.other)}>
        <TextInput
          {...unit.hint('Only needed for Other units')}
          className="govuk-input--width-20"
          defaultValue={values.unitDetail}
          error={fieldErrors.unitDetail}
          label="Enter unit"
          name="unitDetail"
        />
      </div>
    </IndicatorSectionForm>
  );
}
