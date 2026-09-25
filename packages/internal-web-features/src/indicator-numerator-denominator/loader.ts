// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.
import {
  addProviderSource,
  areProviderSourcesOffered,
  type DataProvider,
  dataProviderListSchema,
  type ProviderSourcesSection,
  providerSourcesAnswersSchema,
  providerSourcesFormValues,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { ActionFunctionArgs, LoaderFunctionArgs, RouterContextProvider } from 'react-router';

import { requireIndicatorId } from '../indicator-id.ts';
import { loadIndicatorSectionAnswers, putIndicatorSection } from '../indicator-section.ts';
import {
  type ProviderSourcesPageField,
  type ProviderSourcesPageState,
  type ProviderSourcesPageValues,
  readProviderSourcesForm,
  withSourceAdded,
  withSourceRemoved,
  withSourcesShown,
} from './form.ts';

function loadDataProviders(context: Readonly<RouterContextProvider>): Promise<DataProvider[]> {
  return context.get(apiContext).get('/api/internal/data-providers', dataProviderListSchema);
}

/** The draft's answers, with nothing chosen in the selects, and every provider the form offers. */
export async function loadProviderSources(
  args: LoaderFunctionArgs,
  section: ProviderSourcesSection,
) {
  // Checked before either request, so an id that names nothing asks the API for neither.
  requireIndicatorId(args.params);

  const [{ id, answers }, providers] = await Promise.all([
    loadIndicatorSectionAnswers(args, section.key, providerSourcesAnswersSchema),
    loadDataProviders(args.context),
  ]);
  const values: ProviderSourcesPageValues = {
    ...providerSourcesFormValues(answers),
    providerId: '',
    sourceId: '',
  };

  return { id, providers, values };
}

/** A refused add's errors and the section's others; the add's stand in for the list's. */
function refuseUnaddedSource(
  section: ProviderSourcesSection,
  values: ProviderSourcesPageValues,
  addErrors: Partial<Record<ProviderSourcesPageField, string>>,
): ProviderSourcesPageState {
  const submission = section.schema.safeParse({
    sources: values.sources,
    definition: values.definition,
  });
  const { sources: _refusedList, ...sectionErrors } = submission.success
    ? {}
    : toFieldErrors(submission.error, section.fields.options);

  return { values, fieldErrors: { ...sectionErrors, ...addErrors } };
}

/**
 * Saves the answers, taking in a provider and source chosen but not yet added, and returns to
 * the task list; a refusal saves nothing and re-renders the page as sent.
 */
async function saveProviderSources(
  { context }: ActionFunctionArgs,
  id: string,
  section: ProviderSourcesSection,
  values: ProviderSourcesPageValues,
  providers: readonly DataProvider[],
): Promise<ProviderSourcesPageState | Response> {
  const chosen = values.providerId !== '' || values.sourceId !== '';
  const added = chosen
    ? addProviderSource(section.key, values.sources, values, providers)
    : { sources: values.sources };

  if ('fieldErrors' in added) return refuseUnaddedSource(section, values, added.fieldErrors);

  const submission = section.schema.safeParse({
    sources: added.sources,
    definition: values.definition,
  });

  if (!submission.success) {
    return { values, fieldErrors: toFieldErrors(submission.error, section.fields.options) };
  }

  const saved = await putIndicatorSection(
    context,
    id,
    section,
    submission.data,
    providerSourcesAnswersSchema,
  );

  return saved instanceof Response ? saved : { values, ...saved };
}

/**
 * Show sources, Add and each remove are buttons of their own, which change the page and
 * re-render it without saving: the list travels in the form until Continue saves it.
 */
export async function submitProviderSources(
  args: ActionFunctionArgs,
  section: ProviderSourcesSection,
): Promise<ProviderSourcesPageState | Response> {
  const id = requireIndicatorId(args.params);
  const { intent, values } = readProviderSourcesForm(await args.request.formData());
  const providers = await loadDataProviders(args.context);

  // The page only lists sources the providers offer, so any other was not sent by it.
  if (!areProviderSourcesOffered(values.sources, providers)) {
    throw new Response('Bad Request', { status: 400 });
  }

  if (intent.to === 'show-sources') return withSourcesShown(values, providers);
  if (intent.to === 'add') return withSourceAdded(section.key, values, providers);
  if (intent.to === 'remove') return withSourceRemoved(values, intent.index);

  return saveProviderSources(args, id, section, values, providers);
}
