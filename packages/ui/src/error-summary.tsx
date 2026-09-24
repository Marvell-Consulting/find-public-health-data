import NotGovUKErrorSummary from '@not-govuk/error-summary';

// NotGovUK form controls append '-input' to their field id.
export function fieldInputId(name: string): string {
  return `${name}-input`;
}

// NotGovUK numbers a group's radios from 0; GOV.UK links an error to the first.
export function firstRadioId(name: string): string {
  return `${name}-radio-0`;
}

export interface FieldError {
  /** The `name` of the field the message belongs to. */
  name: string;
  message: string;
  /** The control the link moves to, where it is not `fieldInputId(name)`. */
  id?: string | undefined;
}

interface ErrorSummaryProps {
  errors: FieldError[];
  title?: string;
}

export function ErrorSummary({ errors, title = 'There is a problem' }: ErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <NotGovUKErrorSummary
      title={title}
      items={errors.map(({ id, name, message }) => ({
        href: `#${id ?? fieldInputId(name)}`,
        text: message,
        // GOV.UK Frontend handles focus without a router navigation.
        forceExternal: true,
      }))}
    />
  );
}
