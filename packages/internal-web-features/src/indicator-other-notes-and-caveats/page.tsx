import {
  type OtherNotesAndCaveatsField,
  otherNotesAndCaveatsSection,
} from '@fphd/internal-api-features/contract';
import { firstRadioId, Radios, Textarea } from '@fphd/ui';

import { IndicatorSectionForm, type SectionPageProps } from '../indicator-section-form.tsx';

/** Each question, the detail its Yes reveals, and any answer it offers beyond Yes and No. */
const QUESTIONS = [
  {
    answer: 'disclosureControl',
    detail: 'disclosureControlDetail',
    legend: 'Has disclosure control been applied?',
    notApplicable: true,
  },
  { answer: 'roundingApplied', detail: 'roundingDetail', legend: 'Has any rounding been applied?' },
  { answer: 'caveatsNeeded', detail: 'caveatsDetail', legend: 'Are there any caveats needed?' },
  {
    answer: 'otherNotesNeeded',
    detail: 'otherNotesDetail',
    legend: 'Are there any other notes needed?',
  },
] as const satisfies readonly {
  answer: OtherNotesAndCaveatsField;
  detail: OtherNotesAndCaveatsField;
  legend: string;
  notApplicable?: true;
}[];

export function OtherNotesAndCaveatsPage({
  fieldErrors = {},
  values,
}: SectionPageProps<OtherNotesAndCaveatsField>) {
  return (
    <IndicatorSectionForm
      fieldErrors={fieldErrors}
      fieldIds={Object.fromEntries(QUESTIONS.map(({ answer }) => [answer, firstRadioId(answer)]))}
      fields={otherNotesAndCaveatsSection.fields.options}
      title="Provide any other notes and caveats"
    >
      {QUESTIONS.map((question) => {
        const { answer, detail, legend } = question;
        const error = fieldErrors[answer];

        return (
          <Radios
            key={answer}
            {...(error === undefined ? {} : { error })}
            defaultValue={values[answer]}
            // NotGovUK sizes a legend by the heading passed as its label.
            label={<h2 className="govuk-heading-m">{legend}</h2>}
            name={answer}
            options={[
              {
                value: 'yes',
                label: 'Yes',
                // Shown without JavaScript; with it, only while Yes is chosen.
                conditional: (
                  <Textarea
                    defaultValue={values[detail]}
                    error={fieldErrors[detail]}
                    label="Provide details"
                    name={detail}
                    rows={2}
                  />
                ),
              },
              { value: 'no', label: 'No' },
              ...('notApplicable' in question
                ? [{ value: 'not-applicable', label: 'Not applicable' }]
                : []),
            ]}
          />
        );
      })}
    </IndicatorSectionForm>
  );
}
