import { Button, DocumentTitle, ErrorSummary, GridColumn, GridRow } from '@fphd/ui';
import type { ReactNode } from 'react';

import type { FormValues } from './indicator-section.ts';

/** What every section page is given: its answers, and any refusals of the last submission. */
export interface SectionPageProps<Field extends string, Values = FormValues<Field>> {
  fieldErrors?: Partial<Record<Field, string>> | undefined;
  formError?: string | undefined;
  values: Values;
}

interface IndicatorSectionFormProps<Field extends string> {
  /** The page's h1 and its document title. */
  title: string;
  /** Set when the page asks one question whose label or legend is the h1, so none is added. */
  questionIsHeading?: boolean;
  /** Every field, in the order the form asks them, which the error summary follows. */
  fields: readonly Field[];
  fieldErrors: Partial<Record<Field, string>>;
  /** Required, so no page can drop a refusal that names no field. */
  formError: string | undefined;
  /** Where a summary link goes when it is not the field's own input, such as `firstRadioId`. */
  fieldIds?: Partial<Record<Field, string>>;
  /** Set when the form has buttons of its own before Continue, which Enter would otherwise press. */
  continueOnEnter?: boolean;
  children: ReactNode;
}

/** The frame of a section page: title, error summary, and a form that continues to the task list. */
export function IndicatorSectionForm<Field extends string>({
  children,
  continueOnEnter = false,
  fieldErrors,
  fieldIds = {},
  fields,
  formError,
  questionIsHeading = false,
  title,
}: IndicatorSectionFormProps<Field>) {
  // A message given on several fields, such as the parts of a date, links to the first of them.
  const errors = fields.flatMap((name, index) => {
    const message = fieldErrors[name];
    const repeated = fields.slice(0, index).some((earlier) => fieldErrors[earlier] === message);
    return message === undefined || repeated ? [] : [{ name, message, id: fieldIds[name] }];
  });

  return (
    <>
      <DocumentTitle hasErrors={errors.length > 0 || formError !== undefined} pageTitle={title} />
      <ErrorSummary errors={errors} formError={formError} />
      <GridRow>
        <GridColumn width="two-thirds">
          {questionIsHeading ? null : <h1 className="govuk-heading-xl">{title}</h1>}
          {/* A plain form posting back to its own page, so it works without JavaScript. */}
          <form method="post">
            {/* Enter presses a form's first submit button: this Continue, out of sight and reach. */}
            {continueOnEnter ? (
              <button
                aria-hidden="true"
                className="govuk-visually-hidden"
                tabIndex={-1}
                type="submit"
              >
                Continue
              </button>
            ) : null}
            {children}
            <Button type="submit">Continue</Button>
          </form>
        </GridColumn>
      </GridRow>
    </>
  );
}
