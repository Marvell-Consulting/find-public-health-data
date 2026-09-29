import NotGovUKErrorSummary from '@not-govuk/error-summary';

// NotGovUK form controls append '-input' to their field id.
export function fieldInputId(name: string): string {
  return `${name}-input`;
}

// NotGovUK numbers a group's radios from 0; GOV.UK links an error to the first.
export function firstRadioId(name: string): string {
  return `${name}-radio-0`;
}

// Likewise for a group's checkboxes.
export function firstCheckboxId(name: string): string {
  return `${name}-checkbox-0`;
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
  /** A message for the whole form, listed first and unlinked, as it belongs to no one field. */
  formError?: string | undefined;
  title?: string;
}

export function ErrorSummary({
  errors,
  formError,
  title = 'There is a problem',
}: ErrorSummaryProps) {
  if (errors.length === 0 && formError === undefined) return null;

  return (
    <NotGovUKErrorSummary
      title={title}
      items={[
        ...(formError === undefined ? [] : [{ text: formError }]),
        ...errors.map(({ id, name, message }) => ({
          href: `#${id ?? fieldInputId(name)}`,
          text: message,
          // GOV.UK Frontend handles focus without a router navigation.
          forceExternal: true,
        })),
      ]}
    />
  );
}
