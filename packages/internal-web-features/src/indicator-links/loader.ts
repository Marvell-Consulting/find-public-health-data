// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.
import {
  addLink,
  linksAnswersSchema,
  linksFormValues,
  linksSection,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { requireIndicatorId } from '../indicator-id.ts';
import { loadIndicatorSectionAnswers, putIndicatorSection } from '../indicator-section.ts';
import {
  type LinksPageState,
  type LinksPageValues,
  readLinksForm,
  withLinkAdded,
  withLinkRemoved,
} from './form.ts';

/** The draft's answers, with nothing typed in the fields that add a link. */
export async function loadLinks(args: LoaderFunctionArgs) {
  const { id, answers } = await loadIndicatorSectionAnswers(
    args,
    linksSection.key,
    linksAnswersSchema,
  );
  const values: LinksPageValues = { ...linksFormValues(answers), linkUrl: '', linkText: '' };

  return { id, values };
}

/**
 * Saves the answers, taking in a link typed but not yet added, and returns to the task list;
 * a refusal saves nothing and re-renders the page as sent.
 */
async function saveLinks(
  { context }: ActionFunctionArgs,
  id: string,
  values: LinksPageValues,
): Promise<LinksPageState | Response> {
  const typed = values.linkUrl.trim() !== '' || values.linkText.trim() !== '';
  const added = values.hasLinks === 'yes' && typed ? addLink(values.links, values) : values;

  if ('fieldErrors' in added) return { values, fieldErrors: added.fieldErrors };

  const submission = linksSection.schema.safeParse({
    hasLinks: values.hasLinks,
    links: added.links,
  });

  if (!submission.success) {
    return { values, fieldErrors: toFieldErrors(submission.error, linksSection.fields.options) };
  }

  const saved = await putIndicatorSection(
    context,
    id,
    linksSection,
    submission.data,
    linksAnswersSchema,
  );

  return saved instanceof Response ? saved : { values, ...saved };
}

/**
 * Add and each remove are buttons of their own, which change the list and re-render the
 * page without saving: the list travels in the form until Continue saves it.
 */
export async function submitLinks(args: ActionFunctionArgs): Promise<LinksPageState | Response> {
  const id = requireIndicatorId(args.params);
  const { intent, values } = readLinksForm(await args.request.formData());

  if (intent.to === 'add') return withLinkAdded(values);
  if (intent.to === 'remove') return withLinkRemoved(values, intent.index);

  return saveLinks(args, id, values);
}
