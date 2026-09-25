// No @fphd/ui imports here, so the loaders and actions unit-test without the jsdom the components need.
import {
  type IndicatorSection,
  type IndicatorTaskKey,
  indicatorSectionAnswersSchema,
  indicatorSectionErrorSchema,
  indicatorSectionFormValues,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';

import { requireIndicatorId } from './indicator-id.ts';
import { indicatorTaskListPath } from './publish-paths.ts';

/** A form's fields as text, which is what the page renders into its controls. */
export type FormValues<Field extends string> = Record<Field, string>;

/** A rejected submission: the form as it was sent, and a message for each field refused. */
export interface FormFailure<Field extends string> {
  values: FormValues<Field>;
  fieldErrors: Partial<Record<Field, string>>;
}

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

function sectionApiPath(id: string, key: IndicatorTaskKey): string {
  return apiPath`/api/internal/indicators/${id}/${key}`;
}

/** The draft's answers, filling the form. The API answers 404 when there is no draft. */
export async function loadIndicatorSection<Field extends string, Values>(
  { context, params }: LoaderFunctionArgs,
  section: IndicatorSection<Field, Values>,
): Promise<{ id: string; values: FormValues<Field> }> {
  const id = requireIndicatorId(params);
  const answers = await context
    .get(apiContext)
    .get(sectionApiPath(id, section.key), indicatorSectionAnswersSchema(section.fields));

  return { id, values: indicatorSectionFormValues(section.fields, answers) };
}

/**
 * Saves every answer and returns to the task list, or saves nothing and re-renders the form
 * with what was typed. The API's schema is applied here first, so an incomplete form costs no
 * round trip.
 */
export async function saveIndicatorSection<Field extends string, Values>(
  { context, params, request }: ActionFunctionArgs,
  section: IndicatorSection<Field, Values>,
  controlNames: ControlNames<Field> = {},
): Promise<FormFailure<Field> | Response> {
  const id = requireIndicatorId(params);
  const fields = section.fields.options;
  const values = readFormValues(await request.formData(), fields, controlNames);
  const submission = section.schema.safeParse(values);

  if (!submission.success) {
    return { values, fieldErrors: toFieldErrors(submission.error, fields) };
  }

  const result = await context
    .get(apiContext)
    .put(
      sectionApiPath(id, section.key),
      submission.data,
      indicatorSectionAnswersSchema(section.fields),
      indicatorSectionErrorSchema(section.fields),
    );

  if (!result.ok) {
    return { values, fieldErrors: result.error.fieldErrors ?? {} };
  }

  return redirect(indicatorTaskListPath(id));
}
