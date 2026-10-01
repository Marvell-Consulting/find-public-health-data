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
import { type ControlNames, type FormValues, readFormValues } from './form-values.ts';
import { requireIndicatorId } from './indicator-id.ts';
import { indicatorTaskListPath } from './publish-paths.ts';

/** A rejected submission: the form as it was sent, and why it was refused. */
export interface FormFailure<Field extends string, Values = FormValues<Field>>
  extends FormRefusal<Field> {
  values: Values;
}

/** The control names, or how to read them from the submission where they depend on an answer. */
export type ControlNamesOf<Field extends string> =
  | ControlNames<Field>
  | ((formData: FormData) => ControlNames<Field>);

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
async function putIndicatorSection<Field extends string, Values, Input>(
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

/** A page's answers to save, and the page as it re-renders if they are refused. */
export interface SectionAnswers<Values, Input> {
  values: Values;
  answers: Input;
}

type SchemaError = Parameters<typeof toFieldErrors>[0];

interface SaveSectionOptions<Field extends string, Values, Input> {
  /** The API's answer to a save, which is the section's answers. */
  answersSchema: ApiResponseSchema<unknown>;
  /** Takes in an item typed or chosen but not yet added to a list, or refuses it. */
  takeIn?: (values: Values) => SectionAnswers<Values, Input> | FormFailure<Field, Values>;
  /** Each refused field's message, where the page names fields the section does not. */
  fieldErrorsOf?: (error: SchemaError) => Partial<Record<Field, string>>;
}

/**
 * Saves the page's answers and returns to the task list, or saves nothing and re-renders the
 * page as sent. The API's schema is applied here first, so an incomplete form costs no round
 * trip.
 */
export async function saveIndicatorSectionValues<
  Field extends string,
  Values,
  Input,
  PageValues extends Input,
  PageField extends string = Field,
>(
  context: Readonly<RouterContextProvider>,
  id: string,
  section: IndicatorSection<Field, Values, Input>,
  sent: PageValues,
  {
    answersSchema,
    takeIn = (values) => ({ values, answers: values }),
    fieldErrorsOf,
  }: SaveSectionOptions<PageField, PageValues, Input>,
): Promise<FormFailure<Field, PageValues> | FormFailure<PageField, PageValues> | Response> {
  const taken = takeIn(sent);

  if ('fieldErrors' in taken) return taken;

  const { values, answers } = taken;
  const submission = section.schema.safeParse(answers);

  if (!submission.success) {
    return fieldErrorsOf === undefined
      ? { values, fieldErrors: toFieldErrors(submission.error, section.fields.options) }
      : { values, fieldErrors: fieldErrorsOf(submission.error) };
  }

  const saved = await putIndicatorSection(context, id, section, submission.data, answersSchema);

  return saved instanceof Response ? saved : { values, ...saved };
}

/** Saves every answer of a section whose page asks only its own fields, as text. */
export async function saveIndicatorSection<Field extends string, Values>(
  { context, params, request }: ActionFunctionArgs,
  section: IndicatorSection<Field, Values>,
  controlNames: ControlNamesOf<Field> = {},
): Promise<FormFailure<Field> | Response> {
  const id = requireIndicatorId(params);
  const formData = await request.formData();
  const names = typeof controlNames === 'function' ? controlNames(formData) : controlNames;
  const values = readFormValues(formData, section.fields.options, names);

  return saveIndicatorSectionValues(context, id, section, values, {
    answersSchema: indicatorSectionAnswersSchema(section.fields),
  });
}
