import {
  AGE_LIMIT_FIELDS,
  AGE_RANGE_PARTS,
  type AgeLimitBound,
  type AgeRangeFormValues,
  ageLimitLabel,
  ageRangeFieldName,
  MAX_AGE_RANGES,
  type SexAndAgesFormValues,
  type SexAndAgesPageField,
} from '@fphd/internal-api-features/contract';
import {
  Button,
  Checkboxes,
  fieldInputId,
  firstCheckboxId,
  firstRadioId,
  Radios,
  Select,
  TextInput,
} from '@fphd/ui';
import { AGE_UNITS, SEX_LABELS, SEXES } from '@fphd/utils/sex-and-ages';
import type { ReactNode } from 'react';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';
import { ADD_INTENT, removeIntent } from '../list-form.ts';

type FieldErrors = Partial<Record<SexAndAgesPageField, string>>;

const TITLE = 'What are the sexes and ages included in this indicator?';

const UNIT_OPTIONS = [
  { value: '', label: 'Select' },
  ...AGE_UNITS.map((unit) => ({ value: unit, label: unit })),
];

/** Every field in the order the page asks them, which the error summary follows. */
function pageFields(rangeCount: number): SexAndAgesPageField[] {
  return [
    'sexes',
    'ageType',
    'ageRanges',
    ...Array.from({ length: rangeCount }, (_, index) =>
      AGE_RANGE_PARTS.map((part) => ageRangeFieldName(index, part)),
    ).flat(),
    'specificAge',
    'specificAgeUnit',
    'ageOtherDetail',
  ];
}

/** An error for the NotGovUK controls whose types take one only when there is one. */
function optionalError(error: string | undefined): { error?: string } {
  return error === undefined ? {} : { error };
}

/** "Periods", saying to screen readers which age it is the unit of, as the page repeats it. */
function periodsLabel(of: string): ReactNode {
  return (
    <>
      Periods<span className="govuk-visually-hidden"> for {of}</span>
    </>
  );
}

function AgeLimit({
  bound,
  index,
  range,
  fieldErrors,
}: {
  bound: AgeLimitBound;
  index: number;
  range: AgeRangeFormValues;
  fieldErrors: FieldErrors;
}) {
  const [valueField, unitField] = AGE_LIMIT_FIELDS[bound];
  const valueName = ageRangeFieldName(index, valueField);
  const unitName = ageRangeFieldName(index, unitField);
  const label = ageLimitLabel(bound, index);

  return (
    <div className="fphd-field-row">
      <TextInput
        autoComplete="off"
        className="govuk-input--width-5"
        defaultValue={range[valueField]}
        error={fieldErrors[valueName]}
        inputMode="numeric"
        label={label}
        name={valueName}
      />
      <Select
        {...optionalError(fieldErrors[unitName])}
        defaultValue={range[unitField]}
        label={periodsLabel(label.toLowerCase())}
        name={unitName}
        options={UNIT_OPTIONS}
      />
    </div>
  );
}

/** The ranges as typed, each removable but the first, and the button that adds another. */
function AgeRanges({
  ranges,
  fieldErrors,
}: {
  ranges: readonly AgeRangeFormValues[];
  fieldErrors: FieldErrors;
}) {
  return (
    <>
      <p className="govuk-hint">You must enter at least a lower or upper limit</p>
      {ranges.map((range, index) => (
        <div key={index}>
          <AgeLimit bound="lower" fieldErrors={fieldErrors} index={index} range={range} />
          <AgeLimit bound="upper" fieldErrors={fieldErrors} index={index} range={range} />
          {index === 0 ? null : (
            <Button classModifiers="secondary" name="intent" value={removeIntent(index)}>
              {'Remove range'}
              <span className="govuk-visually-hidden"> {index + 1}</span>
            </Button>
          )}
        </div>
      ))}
      {ranges.length < MAX_AGE_RANGES ? (
        <Button
          classModifiers="secondary"
          className="govuk-!-margin-bottom-0"
          name="intent"
          value={ADD_INTENT}
        >
          Add another range
        </Button>
      ) : null}
    </>
  );
}

export function SexAndAgesPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<SexAndAgesPageField, SexAndAgesFormValues>) {
  const { sexes: sexesError, ageType: ageTypeError } = fieldErrors;

  return (
    <IndicatorSectionForm
      continueOnEnter
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{
        sexes: firstCheckboxId('sexes'),
        ageType: firstRadioId('ageType'),
        ageRanges: fieldInputId(ageRangeFieldName(0, 'lowerLimit')),
      }}
      fields={pageFields(values.ageRanges.length)}
      title={TITLE}
    >
      <Checkboxes
        {...optionalError(sexesError)}
        defaultValue={values.sexes}
        // NotGovUK sizes a legend by the heading passed as its label.
        label={<h2 className="govuk-heading-m">Select sexes included</h2>}
        name="sexes"
        options={SEXES.map((sex) => ({ value: sex, label: SEX_LABELS[sex] }))}
      />
      <Radios
        {...optionalError(ageTypeError)}
        defaultValue={values.ageType}
        label={<h2 className="govuk-heading-m">Select age type</h2>}
        name="ageType"
        options={[
          { value: 'all', label: 'All ages' },
          {
            value: 'range',
            label: 'Age range',
            // Shown without JavaScript; with it, only while this age type is chosen.
            conditional: (
              <AgeRanges
                fieldErrors={{
                  ...fieldErrors,
                  // A refusal of the list as a whole is shown where the first range starts.
                  [ageRangeFieldName(0, 'lowerLimit')]:
                    fieldErrors[ageRangeFieldName(0, 'lowerLimit')] ?? fieldErrors.ageRanges,
                }}
                ranges={values.ageRanges}
              />
            ),
          },
          {
            value: 'specific',
            label: 'Specific age',
            conditional: (
              <>
                <TextInput
                  autoComplete="off"
                  className="govuk-input--width-5"
                  defaultValue={values.specificAge}
                  error={fieldErrors.specificAge}
                  inputMode="numeric"
                  label="Age"
                  name="specificAge"
                />
                <Select
                  {...optionalError(fieldErrors.specificAgeUnit)}
                  defaultValue={values.specificAgeUnit}
                  label={periodsLabel('age')}
                  name="specificAgeUnit"
                  options={UNIT_OPTIONS}
                />
              </>
            ),
          },
          {
            value: 'other',
            label: 'Other',
            conditional: (
              <TextInput
                defaultValue={values.ageOtherDetail}
                error={fieldErrors.ageOtherDetail}
                label={<span className="govuk-visually-hidden">Other</span>}
                name="ageOtherDetail"
              />
            ),
          },
        ]}
      />
    </IndicatorSectionForm>
  );
}
