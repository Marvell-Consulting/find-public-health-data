import NotGovUKErrorSummary from '@not-govuk/error-summary';

// NotGovUK form controls append '-input' to their field id.
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

export function ErrorSummary({ errors, title = 'There is a problem' }: ErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <NotGovUKErrorSummary
      title={title}
      items={errors.map(({ name, message }) => ({
        href: `#${fieldInputId(name)}`,
        text: message,
        // GOV.UK Frontend handles focus without a router navigation.
        forceExternal: true,
      }))}
    />
  );
}
