// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.

import type { SexAndAgesFormValues } from '@fphd/internal-api-features/contract';
import {
  sexAndAgesAnswersSchema,
  sexAndAgesFieldErrors,
  sexAndAgesFormValues,
  sexAndAgesSection,
} from '@fphd/internal-api-features/contract';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { requireIndicatorId } from '../indicator-id.ts';
import { loadIndicatorSectionAnswers, putIndicatorSection } from '../indicator-section.ts';
import {
  readSexAndAgesForm,
  type SexAndAgesPageState,
  withAgeRangeAdded,
  withAgeRangeRemoved,
  withAgeRangeShown,
} from './form.ts';

/** The draft's answers, with a blank range where it holds none. */
export async function loadSexAndAges(args: LoaderFunctionArgs) {
  const { id, answers } = await loadIndicatorSectionAnswers(
    args,
    sexAndAgesSection.key,
    sexAndAgesAnswersSchema,
  );

  return { id, values: withAgeRangeShown(sexAndAgesFormValues(answers)) };
}

/** Saves the answers and returns to the task list; a refusal saves nothing and re-renders the page. */
async function saveSexAndAges(
  { context }: ActionFunctionArgs,
  id: string,
  values: SexAndAgesFormValues,
): Promise<SexAndAgesPageState | Response> {
  const submission = sexAndAgesSection.schema.safeParse(values);

  if (!submission.success) {
    return { values, fieldErrors: sexAndAgesFieldErrors(submission.error) };
  }

  const saved = await putIndicatorSection(
    context,
    id,
    sexAndAgesSection,
    submission.data,
    sexAndAgesAnswersSchema,
  );

  return saved instanceof Response ? saved : { values, ...saved };
}

/**
 * Add and each remove are buttons of their own, which change the ranges and re-render the
 * page without saving: the ranges travel in the form until Continue saves them.
 */
export async function submitSexAndAges(
  args: ActionFunctionArgs,
): Promise<SexAndAgesPageState | Response> {
  const id = requireIndicatorId(args.params);
  const { intent, values } = readSexAndAgesForm(await args.request.formData());

  if (intent.to === 'add') return withAgeRangeAdded(values);
  if (intent.to === 'remove') return withAgeRangeRemoved(values, intent.index);

  return saveSexAndAges(args, id, values);
}
