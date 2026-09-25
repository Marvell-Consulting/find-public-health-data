import { type BenchmarkingField, benchmarkingSection } from '@fphd/internal-api-features/contract';
import { firstRadioId, Radios, Textarea, TextInput } from '@fphd/ui';
import { GOAL_POLARITIES, GOAL_POLARITY_LABELS } from '@fphd/utils/polarity';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

export function BenchmarkingPage({
  fieldErrors = {},
  formError,
  values,
}: SectionPageProps<BenchmarkingField>) {
  // Radios take no undefined error.
  const errorOf = (field: BenchmarkingField) => {
    const error = fieldErrors[field];
    return error === undefined ? {} : { error };
  };

  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      formError={formError}
      fieldIds={{
        hasGoalBenchmark: firstRadioId('hasGoalBenchmark'),
        goalPolarity: firstRadioId('goalPolarity'),
      }}
      fields={benchmarkingSection.fields.options}
      title="Benchmarking"
    >
      <Radios
        {...errorOf('hasGoalBenchmark')}
        defaultValue={values.hasGoalBenchmark}
        // NotGovUK sizes a legend by the heading passed as its label.
        label={
          <h2 className="govuk-heading-m">Are there any goal benchmarks for this indicator?</h2>
        }
        name="hasGoalBenchmark"
        options={[
          {
            value: 'yes',
            label: 'Yes',
            // Shown without JavaScript; with it, only while Yes is chosen.
            conditional: (
              <>
                <TextInput
                  autoComplete="off"
                  className="govuk-input--width-5"
                  defaultValue={values.goalLowerValue}
                  error={fieldErrors.goalLowerValue}
                  hint="Value type must be the same as those used for data values in this indicator. You do not need to enter units."
                  label="Enter lower goal value"
                  name="goalLowerValue"
                  spellCheck={false}
                />
                <TextInput
                  autoComplete="off"
                  className="govuk-input--width-5"
                  defaultValue={values.goalUpperValue}
                  error={fieldErrors.goalUpperValue}
                  hint="Leave this blank if there is only a single goal value"
                  label="Enter upper goal value"
                  name="goalUpperValue"
                  spellCheck={false}
                />
                <Radios
                  {...errorOf('goalPolarity')}
                  classModifiers="small"
                  defaultValue={values.goalPolarity}
                  label={<h3 className="govuk-heading-s">Select polarity of goal</h3>}
                  name="goalPolarity"
                  options={GOAL_POLARITIES.map((value) => ({
                    value,
                    label: GOAL_POLARITY_LABELS[value],
                  }))}
                />
                <Textarea
                  defaultValue={values.goalPolicyDetail}
                  error={fieldErrors.goalPolicyDetail}
                  label="Provide detail about the policy goal"
                  name="goalPolicyDetail"
                  rows={5}
                />
              </>
            ),
          },
          { value: 'no', label: 'No' },
        ]}
      />
    </IndicatorSectionForm>
  );
}
