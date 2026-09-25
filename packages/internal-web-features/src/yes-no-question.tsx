import { Radios, Textarea } from '@fphd/ui';

import type { FormValues } from './indicator-section.ts';

interface YesNoQuestionProps<Field extends string> {
  /** The radios' field, whose Yes reveals the details field. */
  answer: Field;
  detail: Field;
  legend: string;
  hint?: string;
  detailLabel: string;
  detailRows: number;
  values: FormValues<Field>;
  fieldErrors: Partial<Record<Field, string>>;
  /** Answers offered after Yes and No, such as "Not applicable". */
  moreOptions?: readonly { value: string; label: string }[];
}

/** A yes/no question whose Yes asks for details; link its errors with `firstRadioId(answer)`. */
export function YesNoQuestion<Field extends string>({
  answer,
  detail,
  detailLabel,
  detailRows,
  fieldErrors,
  hint,
  legend,
  moreOptions = [],
  values,
}: YesNoQuestionProps<Field>) {
  const error = fieldErrors[answer];

  return (
    <Radios
      {...(error === undefined ? {} : { error })}
      defaultValue={values[answer]}
      {...(hint === undefined ? {} : { hint })}
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
              label={detailLabel}
              name={detail}
              rows={detailRows}
            />
          ),
        },
        { value: 'no', label: 'No' },
        ...moreOptions,
      ]}
    />
  );
}
