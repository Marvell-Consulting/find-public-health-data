import { type PeriodTypeField, periodTypeSection } from '@fphd/internal-api-features/contract';
import { DayMonthInput, datePartId, datePartName, firstRadioId, Radios } from '@fphd/ui';
import {
  PERIOD_TYPE_LABELS,
  PERIOD_TYPES_WITH_YEAR_TYPE,
  YEAR_TYPE_LABELS,
} from '@fphd/utils/period-type';

import { errorProp } from '../error-prop.ts';
import type { ControlNames } from '../indicator-section.ts';
import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

/** The period types that ask for a year type, each asking it in its own reveal. */
type YearTypeSet = (typeof PERIOD_TYPES_WITH_YEAR_TYPE)[number];

type YearTypeField = Exclude<PeriodTypeField, 'periodType'>;

/** Without JavaScript every reveal shows, so each set of year type controls has its own names. */
function yearTypeControls(set: YearTypeSet, control: (group: string, part: string) => string) {
  return {
    yearType: `${set}YearType`,
    yearEndDay: control(`${set}YearEnd`, 'day'),
    yearEndMonth: control(`${set}YearEnd`, 'month'),
  } satisfies Record<YearTypeField, string>;
}

function yearTypeSetOf(periodType: string): YearTypeSet | undefined {
  return PERIOD_TYPES_WITH_YEAR_TYPE.find((set) => set === periodType);
}

/** The year type answers are read from the set under the chosen period type, and no other. */
export function periodTypeControlNames(formData: FormData): ControlNames<PeriodTypeField> {
  const periodType = formData.get('periodType');
  const set = typeof periodType === 'string' ? yearTypeSetOf(periodType) : undefined;

  return set === undefined ? {} : yearTypeControls(set, datePartName);
}

const NO_YEAR_TYPE: Record<YearTypeField, string> = {
  yearType: '',
  yearEndDay: '',
  yearEndMonth: '',
};

interface YearTypeQuestionProps {
  set: YearTypeSet;
  /** The answers and messages of the set under the chosen period type; empty for the other. */
  values: Record<YearTypeField, string>;
  fieldErrors: Partial<Record<PeriodTypeField, string>>;
}

function YearTypeQuestion({ fieldErrors, set, values }: YearTypeQuestionProps) {
  const { yearEndDay, yearEndMonth, yearType: yearTypeError } = fieldErrors;
  const yearEndError = {
    ...(yearEndDay === undefined ? {} : { day: yearEndDay }),
    ...(yearEndMonth === undefined ? {} : { month: yearEndMonth }),
  };

  return (
    <Radios
      {...errorProp(yearTypeError)}
      classModifiers="small"
      defaultValue={values.yearType}
      // NotGovUK sizes a legend by its label's heading level or class; an h3 would be medium.
      label={<span className="govuk-heading-s">Select year type</span>}
      name={`${set}YearType`}
      options={[
        ...(['calendar', 'financial', 'academic', 'rolling'] as const).map((value) => ({
          label: YEAR_TYPE_LABELS[value],
          value,
        })),
        {
          label: YEAR_TYPE_LABELS['specified-end-date'],
          value: 'specified-end-date',
          conditional: (
            <DayMonthInput
              defaultValue={{ day: values.yearEndDay, month: values.yearEndMonth }}
              error={yearEndError}
              label={<span className="govuk-visually-hidden">Enter date</span>}
              name={`${set}YearEnd`}
            />
          ),
        },
      ]}
    />
  );
}

// The same year type question sits under both Years and Quarters; only the chosen one is read.
export function PeriodTypePage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<PeriodTypeField>) {
  const chosenSet = yearTypeSetOf(values.periodType);

  const question = (set: YearTypeSet) => (
    <YearTypeQuestion
      fieldErrors={set === chosenSet ? fieldErrors : {}}
      set={set}
      values={set === chosenSet ? values : NO_YEAR_TYPE}
    />
  );

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{
        periodType: firstRadioId('periodType'),
        ...(chosenSet === undefined
          ? {}
          : {
              ...yearTypeControls(chosenSet, datePartId),
              yearType: firstRadioId(`${chosenSet}YearType`),
            }),
      }}
      fields={periodTypeSection.fields.options}
      title="What is the period type in this indicator?"
    >
      <Radios
        {...errorProp(fieldErrors.periodType)}
        defaultValue={values.periodType}
        // NotGovUK sizes a legend by the heading passed as its label.
        label={<h2 className="govuk-heading-m">Select period type</h2>}
        name="periodType"
        options={[
          {
            label: PERIOD_TYPE_LABELS.years,
            value: 'years',
            conditional: question('years'),
          },
          {
            label: PERIOD_TYPE_LABELS.quarters,
            value: 'quarters',
            conditional: question('quarters'),
          },
          { label: PERIOD_TYPE_LABELS.months, value: 'months' },
        ]}
      />
    </IndicatorSectionForm>
  );
}
