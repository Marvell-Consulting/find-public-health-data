/**
 * `TextInput` and `Textarea` give the control itself an id of `<name>-input`, keeping the
 * form group's id free for the wrapper. An error summary link has to target the control, so
 * the convention lives here rather than being spelled out at every call site.
 */
export function fieldInputId(name: string): string {
  return `${name}-input`;
}

export interface FieldError {
  /** The `name` of the field the message belongs to. */
  name: string;
  message: string;
}

interface ErrorSummaryProps {
  errors: FieldError[];
  title?: string;
}

/**
 * Plain GOV.UK Frontend markup rather than `@not-govuk/error-summary`: that component routes
 * its links through React Router, so clicking one would navigate, re-run the loader and
 * discard the values the publisher just submitted. A bare anchor jumps to the field and
 * leaves the page as the action rendered it.
 */
export function ErrorSummary({ errors, title = 'There is a problem' }: ErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div className="govuk-error-summary" data-module="govuk-error-summary">
      <div role="alert">
        <h2 className="govuk-error-summary__title">{title}</h2>
        <div className="govuk-error-summary__body">
          <ul className="govuk-list govuk-error-summary__list">
            {errors.map((error) => (
              <li key={error.name}>
                <a href={`#${fieldInputId(error.name)}`}>{error.message}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
