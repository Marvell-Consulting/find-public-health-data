// No @fphd/ui imports here, so the loaders and actions unit-test without the jsdom the components need.
import {
  type IndicatorSection,
  type IndicatorTaskKey,
  indicatorSectionAnswersSchema,
  indicatorSectionErrorSchema,
  indicatorSectionFormValues,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';
import { type ApiResponseSchema, apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouterContextProvider,
  redirect,
} from 'react-router';

import { type FormRefusal, formRefusal } from './form-refusal.ts';
import { requireIndicatorId } from './indicator-id.ts';
import { indicatorTaskListPath } from './publish-paths.ts';

/** A form's fields as text, which is what the page renders into its controls. */
export type FormValues<Field extends string> = Record<Field, string>;

/** A rejected submission: the form as it was sent, and why it was refused. */
export interface FormFailure<Field extends string, Values = FormValues<Field>>
  extends FormRefusal<Field> {
  values: Values;
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

/** The draft's answers to one section. The API answers 404 when there is no draft. */
export async function loadIndicatorSectionAnswers<Answers>(
  { context, params }: LoaderFunctionArgs,
  key: IndicatorTaskKey,
  answersSchema: ApiResponseSchema<Answers>,
): Promise<{ id: string; answers: Answers }> {
  const id = requireIndicatorId(params);
  const answers = await context.get(apiContext).get(sectionApiPath(id, key), answersSchema);

  return { id, answers };
}

/** The draft's answers, filling the form. */
export async function loadIndicatorSection<Field extends string, Values>(
  args: LoaderFunctionArgs,
  section: IndicatorSection<Field, Values>,
): Promise<{ id: string; values: FormValues<Field> }> {
  const { id, answers } = await loadIndicatorSectionAnswers(
    args,
    section.key,
    indicatorSectionAnswersSchema(section.fields),
  );

  return { id, values: indicatorSectionFormValues(section.fields, answers) };
}

/**
 * Saves answers the form has accepted and returns to the task list, or answers why the API
 * refused them, in which case it saved nothing.
 */
export async function putIndicatorSection<Field extends string, Values, Input>(
  context: Readonly<RouterContextProvider>,
  id: string,
  section: IndicatorSection<Field, Values, Input>,
  answers: Values,
  answersSchema: ApiResponseSchema<unknown>,
): Promise<Response | FormRefusal<Field>> {
  const result = await context
    .get(apiContext)
    .put(
      sectionApiPath(id, section.key),
      answers,
      answersSchema,
      indicatorSectionErrorSchema(section.fields),
    );

  return result.ok ? redirect(indicatorTaskListPath(id)) : formRefusal(result.error);
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

  const saved = await putIndicatorSection(
    context,
    id,
    section,
    submission.data,
    indicatorSectionAnswersSchema(section.fields),
  );

  return saved instanceof Response ? saved : { values, ...saved };
}
