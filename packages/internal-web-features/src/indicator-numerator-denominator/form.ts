import {
  addProviderSource,
  type DataProvider,
  type IndicatorSourcePart,
  type NewProviderSourceField,
  type NewProviderSourceFormValues,
  type ProviderSource,
  type ProviderSourcesField,
  type ProviderSourcesFormValues,
  type ProviderSourcesSection,
  providerSourceSchema,
  SELECT_DATA_PROVIDER,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';

import { readFormValues } from '../form-values.ts';
import type { FormFailure, SectionAnswers } from '../indicator-section.ts';
import { type ListIntent, readListIntent, readListItems } from '../list-form.ts';

/** The page's answers, the sources added so far, and the two selects that add another. */
export type NumeratorDenominatorPageValues = ProviderSourcesFormValues &
  NewProviderSourceFormValues;

export type NumeratorDenominatorPageField = ProviderSourcesField | NewProviderSourceField;

/** The page as the action re-renders it: after a refusal, or with its list or selects changed. */
export type NumeratorDenominatorPageState = FormFailure<
  NumeratorDenominatorPageField,
  NumeratorDenominatorPageValues
>;

/** The value of the button that offers the chosen provider's sources without JavaScript. */
export const SHOW_SOURCES_INTENT = 'show-sources';

/** Which button sent the form: Show sources, or one of the list's. */
type NumeratorDenominatorIntent = { to: 'show-sources' } | ListIntent;

/** The name of the hidden field holding one part of the source at `index`. */
export function sourceFieldName(index: number, part: keyof ProviderSource): string {
  return `sources[${index}].${part}`;
}

function readIntent(formData: FormData): NumeratorDenominatorIntent {
  return formData.get('intent') === SHOW_SOURCES_INTENT
    ? { to: 'show-sources' }
    : readListIntent(formData);
}

/**
 * The sources the form carries, where an empty source is none specific. The page only ever
 * writes ones already accepted, so one that fails the rules was not sent by it, and the
 * request is refused whole.
 */
function readSources(formData: FormData): ProviderSource[] {
  return readListItems(formData, ['providerId', 'sourceId'], sourceFieldName).map(
    ({ providerId, sourceId }) => {
      const source = providerSourceSchema.safeParse({
        providerId,
        sourceId: sourceId === '' ? null : sourceId,
      });

      if (!source.success) throw new Response('Bad Request', { status: 400 });

      return source.data;
    },
  );
}

/** The form as sent, and which of its buttons sent it; a field not sent is empty. */
export function readNumeratorDenominatorForm(formData: FormData): {
  values: NumeratorDenominatorPageValues;
  intent: NumeratorDenominatorIntent;
} {
  return {
    values: {
      ...readFormValues(formData, ['definition', 'providerId', 'sourceId']),
      sources: readSources(formData),
    },
    intent: readIntent(formData),
  };
}

/** The page offering the chosen provider's sources, as a browser without JavaScript asks. */
export function withSourcesShown(
  values: NumeratorDenominatorPageValues,
  providers: readonly DataProvider[],
): NumeratorDenominatorPageState {
  const shown = { ...values, sourceId: '' };

  return providers.some(({ id }) => id === values.providerId)
    ? { values: shown, fieldErrors: {} }
    : { values: shown, fieldErrors: { providerId: SELECT_DATA_PROVIDER } };
}

/** The page with the chosen provider and source added and the selects cleared, or refused. */
export function withSourceAdded(
  part: IndicatorSourcePart,
  values: NumeratorDenominatorPageValues,
  providers: readonly DataProvider[],
): NumeratorDenominatorPageState {
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
  values: NumeratorDenominatorPageValues,
  index: number,
): NumeratorDenominatorPageState {
  return {
    values: { ...values, sources: values.sources.filter((_, at) => at !== index) },
    fieldErrors: {},
  };
}

/** A refused add's errors and the section's others; the add's stand in for the list's. */
function refuseUnaddedSource(
  section: ProviderSourcesSection,
  values: NumeratorDenominatorPageValues,
  addErrors: Partial<Record<NumeratorDenominatorPageField, string>>,
): NumeratorDenominatorPageState {
  const submission = section.schema.safeParse({
    sources: values.sources,
    definition: values.definition,
  });
  const { sources: _refusedList, ...sectionErrors } = submission.success
    ? {}
    : toFieldErrors(submission.error, section.fields.options);

  return { values, fieldErrors: { ...sectionErrors, ...addErrors } };
}

/** The answers with a provider and source chosen but not yet added taken in, or refused. */
export function withChosenSourceTakenIn(
  section: ProviderSourcesSection,
  values: NumeratorDenominatorPageValues,
  providers: readonly DataProvider[],
):
  | SectionAnswers<NumeratorDenominatorPageValues, ProviderSourcesFormValues>
  | NumeratorDenominatorPageState {
  const chosen = values.providerId !== '' || values.sourceId !== '';
  const added = chosen
    ? addProviderSource(section.key, values.sources, values, providers)
    : { sources: values.sources };

  return 'fieldErrors' in added
    ? refuseUnaddedSource(section, values, added.fieldErrors)
    : { values, answers: { sources: added.sources, definition: values.definition } };
}
