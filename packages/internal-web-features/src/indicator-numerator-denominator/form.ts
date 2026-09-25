import {
  addProviderSource,
  type DataProvider,
  type IndicatorSourcePart,
  type NewProviderSourceField,
  type NewProviderSourceFormValues,
  type ProviderSource,
  type ProviderSourcesField,
  type ProviderSourcesFormValues,
  providerSourceSchema,
  SELECT_DATA_PROVIDER,
} from '@fphd/internal-api-features/contract';

import type { FormFailure } from '../indicator-section.ts';

/** The page's answers, the sources added so far, and the two selects that add another. */
export type ProviderSourcesPageValues = ProviderSourcesFormValues & NewProviderSourceFormValues;

export type ProviderSourcesPageField = ProviderSourcesField | NewProviderSourceField;

/** The page as the action re-renders it: after a refusal, or with its list or selects changed. */
export type ProviderSourcesPageState = FormFailure<
  ProviderSourcesPageField,
  ProviderSourcesPageValues
>;

/** Which button sent the form. Continue has no name, so a form sent any other way continues. */
export type ProviderSourcesIntent =
  | { to: 'show-sources' }
  | { to: 'add' }
  | { to: 'remove'; index: number }
  | { to: 'continue' };

/** The name of the hidden field holding one part of the source at `index`. */
export function sourceFieldName(index: number, part: keyof ProviderSource): string {
  return `sources[${index}].${part}`;
}

/** The value of the button that removes the source at `index`. */
export function removeSourceIntent(index: number): string {
  return `remove-${index}`;
}

const REMOVE_INTENT = /^remove-(\d+)$/;

function readIntent(formData: FormData): ProviderSourcesIntent {
  const intent = formData.get('intent');

  if (intent === 'show-sources') return { to: 'show-sources' };
  if (intent === 'add') return { to: 'add' };

  const removed = typeof intent === 'string' ? REMOVE_INTENT.exec(intent) : null;

  return removed === null ? { to: 'continue' } : { to: 'remove', index: Number(removed[1]) };
}

/**
 * The sources the form carries, where an empty source is none specific. The page only ever
 * writes ones already accepted, so one that fails the rules was not sent by it, and the
 * request is refused whole.
 */
function readSources(formData: FormData): ProviderSource[] {
  const sources: ProviderSource[] = [];

  for (let index = 0; formData.has(sourceFieldName(index, 'providerId')); index++) {
    const sourceId = formData.get(sourceFieldName(index, 'sourceId'));
    const source = providerSourceSchema.safeParse({
      providerId: formData.get(sourceFieldName(index, 'providerId')),
      sourceId: sourceId === '' ? null : sourceId,
    });

    if (!source.success) throw new Response('Bad Request', { status: 400 });

    sources.push(source.data);
  }

  return sources;
}

/** The form as sent, and which of its buttons sent it; a field not sent is empty. */
export function readProviderSourcesForm(formData: FormData): {
  values: ProviderSourcesPageValues;
  intent: ProviderSourcesIntent;
} {
  const text = (name: 'definition' | NewProviderSourceField) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };

  return {
    values: {
      sources: readSources(formData),
      definition: text('definition'),
      providerId: text('providerId'),
      sourceId: text('sourceId'),
    },
    intent: readIntent(formData),
  };
}

/** The page offering the chosen provider's sources, as a browser without JavaScript asks. */
export function withSourcesShown(
  values: ProviderSourcesPageValues,
  providers: readonly DataProvider[],
): ProviderSourcesPageState {
  const shown = { ...values, sourceId: '' };

  return providers.some(({ id }) => id === values.providerId)
    ? { values: shown, fieldErrors: {} }
    : { values: shown, fieldErrors: { providerId: SELECT_DATA_PROVIDER } };
}

/** The page with the chosen provider and source added and the selects cleared, or refused. */
export function withSourceAdded(
  part: IndicatorSourcePart,
  values: ProviderSourcesPageValues,
  providers: readonly DataProvider[],
): ProviderSourcesPageState {
  const added = addProviderSource(part, values.sources, values, providers);

  return 'fieldErrors' in added
    ? { values, fieldErrors: added.fieldErrors }
    : {
        values: { ...values, sources: added.sources, providerId: '', sourceId: '' },
        fieldErrors: {},
      };
}

/** The page without the source at `index`, keeping anything chosen or typed. */
export function withSourceRemoved(
  values: ProviderSourcesPageValues,
  index: number,
): ProviderSourcesPageState {
  return {
    values: { ...values, sources: values.sources.filter((_, at) => at !== index) },
    fieldErrors: {},
  };
}
