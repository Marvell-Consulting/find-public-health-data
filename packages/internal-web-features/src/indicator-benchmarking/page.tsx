import { type BenchmarkingField, benchmarkingSection } from '@fphd/internal-api-features/contract';
import { errorProp, firstRadioId, QuestionLegend, Radios, Textarea, TextInput } from '@fphd/ui';
import { GOAL_POLARITIES, GOAL_POLARITY_LABELS } from '@fphd/utils/polarity';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

export function BenchmarkingPage(form: SectionPageProps<BenchmarkingField>) {
  const { fieldErrors, values } = form;

  return (
    <IndicatorSectionForm
      form={form}
      fieldIds={{
        hasGoalBenchmark: firstRadioId('hasGoalBenchmark'),
        goalPolarity: firstRadioId('goalPolarity'),
      }}
      section={benchmarkingSection}
      title="Benchmarking"
    >
      <Radios
        {...errorProp(fieldErrors.hasGoalBenchmark)}
        defaultValue={values.hasGoalBenchmark}
        label={<QuestionLegend>Are there any goal benchmarks for this indicator?</QuestionLegend>}
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
                  {...errorProp(fieldErrors.goalPolarity)}
                  classModifiers="small"
                  defaultValue={values.goalPolarity}
                  label={
                    <QuestionLegend as="h3" size="s">
                      Select polarity of goal
                    </QuestionLegend>
                  }
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
