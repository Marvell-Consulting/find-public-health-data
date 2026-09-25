// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.
import {
  taggingAnswersSchema,
  taggingFormValues,
  taggingSection,
  tagOptionsSchema,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { requireIndicatorId } from '../indicator-id.ts';
import { loadIndicatorSectionAnswers, putIndicatorSection } from '../indicator-section.ts';
import {
  readTaggingForm,
  type TaggingPageState,
  type TaggingPageValues,
  taggingPageValues,
  withChosenTagsAdded,
  withTagAdded,
  withTagRemoved,
} from './form.ts';

/** The draft's tags, and every tag the page offers. */
export async function loadTagging(args: LoaderFunctionArgs) {
  // Checked before either request, so an id that names nothing asks the API for neither.
  requireIndicatorId(args.params);

  const [{ id, answers }, options] = await Promise.all([
    loadIndicatorSectionAnswers(args, taggingSection.key, taggingAnswersSchema),
    args.context.get(apiContext).get('/api/internal/tags', tagOptionsSchema),
  ]);

  return { id, options, values: taggingPageValues(taggingFormValues(answers)) };
}

/**
 * Saves the answers, taking in any tag chosen but not yet added, and returns to the task
 * list; a refusal saves nothing and re-renders the page with those tags added.
 */
async function saveTagging(
  { context }: ActionFunctionArgs,
  id: string,
  sent: TaggingPageValues,
): Promise<TaggingPageState | Response> {
  const values = withChosenTagsAdded(sent);
  const submission = taggingSection.schema.safeParse(values);

  if (!submission.success) {
    return {
      values,
      fieldErrors: toFieldErrors(submission.error, taggingSection.fields.options),
    };
  }

  const saved = await putIndicatorSection(
    context,
    id,
    taggingSection,
    submission.data,
    taggingAnswersSchema,
  );

  return saved instanceof Response ? saved : { values, ...saved };
}

/**
 * Each Add and Remove is a button of its own, which changes a list and re-renders the page
 * without saving: the lists travel in the form until Continue saves them.
 */
export async function submitTagging(
  args: ActionFunctionArgs,
): Promise<TaggingPageState | Response> {
  const id = requireIndicatorId(args.params);
  const { intent, values } = readTaggingForm(await args.request.formData());

  if (intent.to !== 'continue' && intent.list !== undefined) {
    return intent.to === 'add'
      ? withTagAdded(values, intent.list)
      : withTagRemoved(values, intent.list, intent.index);
  }

  return saveTagging(args, id, values);
}
