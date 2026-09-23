import { Button, DocumentTitle, ErrorSummary, GridColumn, GridRow } from '@fphd/ui';
import type { ReactNode } from 'react';

interface IndicatorSectionFormProps<Field extends string> {
  /** The page's h1 and its document title. */
  title: string;
  /** Set when the page asks one question whose label or legend is the h1, so none is added. */
  questionIsHeading?: boolean;
  /** Every field, in the order the form asks them, which the error summary follows. */
  fields: readonly Field[];
  fieldErrors: Partial<Record<Field, string>>;
  /** Where a summary link goes when it is not the field's own input, such as `firstRadioId`. */
  fieldIds?: Partial<Record<Field, string>>;
  children: ReactNode;
}

/** The frame of a section page: title, error summary, and a form that continues to the task list. */
export function IndicatorSectionForm<Field extends string>({
  children,
  fieldErrors,
  fieldIds = {},
  fields,
  questionIsHeading = false,
  title,
}: IndicatorSectionFormProps<Field>) {
  const errors = fields.flatMap((name) => {
    const message = fieldErrors[name];
    return message === undefined ? [] : [{ name, message, id: fieldIds[name] }];
  });

  return (
    <>
      <DocumentTitle hasErrors={errors.length > 0} pageTitle={title} />
      <ErrorSummary errors={errors} />
      <GridRow>
        <GridColumn width="two-thirds">
          {questionIsHeading ? null : <h1 className="govuk-heading-xl">{title}</h1>}
          {/* A plain form posting back to its own page, so it works without JavaScript. */}
          <form method="post">
            {children}
            <Button type="submit">Continue</Button>
          </form>
        </GridColumn>
      </GridRow>
    </>
  );
}
