/** A form's fields as text, which is what the page renders into its controls. */
export type FormValues<Field extends string> = Record<Field, string>;

/** The name of each control whose name is not its field's, such as a part of a date. */
export type ControlNames<Field extends string> = Partial<Record<Field, string>>;

/** Each field as typed; one the browser did not send, such as an unchosen radio, is empty. */
export function readFormValues<Field extends string>(
  formData: FormData,
  fields: readonly Field[],
  controlNames: ControlNames<Field> = {},
): FormValues<Field> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(controlNames[field] ?? field);
      return [field, typeof value === 'string' ? value : ''];
    }),
  ) as FormValues<Field>;
}
