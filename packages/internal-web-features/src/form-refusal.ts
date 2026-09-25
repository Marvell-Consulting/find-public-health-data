/** Shown when the API refused a submission without naming a field the form could mark. */
export const FORM_NOT_SAVED = 'Your answers could not be saved. Try again.';

/** Why a submission was refused: a message for each field at fault, or one for the whole form. */
export interface FormRefusal<Field extends string> {
  fieldErrors: Partial<Record<Field, string>>;
  formError?: string | undefined;
}

/** The API's refusal as the form shows it, so a refusal never re-renders the page unexplained. */
export function formRefusal<Field extends string>(refusal: {
  error: string;
  fieldErrors?: Partial<Record<Field, string>> | undefined;
}): FormRefusal<Field> {
  const fieldErrors = refusal.fieldErrors ?? {};

  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors }
    : { fieldErrors, formError: FORM_NOT_SAVED };
}
