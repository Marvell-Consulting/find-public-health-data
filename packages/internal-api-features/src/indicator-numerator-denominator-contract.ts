import { z } from '@fphd/config/zod';

import type { IndicatorSection } from './indicator-section-contract.ts';

const namedSchema = z.object({ id: z.uuid(), name: z.string().min(1) });

/** A provider of data, and the sources it offers, which a publisher may also leave unnamed. */
export const dataProviderSchema = namedSchema.extend({ sources: z.array(namedSchema) });

/** Every provider a publisher may choose, in the order the form lists them. */
export const dataProviderListSchema = z.array(dataProviderSchema);

export type DataProvider = z.infer<typeof dataProviderSchema>;

/** The two pages, which ask the same questions of the two halves of a calculation. */
export type IndicatorSourcePart = 'numerator' | 'denominator';

export const MAX_PROVIDER_SOURCES = 20;

/** A provider, and the source of its data, or null where there is no specific source. */
export const providerSourceSchema = z.object({
  providerId: z.uuid(),
  sourceId: z.uuid().nullable(),
});

export type ProviderSource = z.infer<typeof providerSourceSchema>;

const sameProviderSource = (a: ProviderSource, b: ProviderSource) =>
  a.providerId === b.providerId && a.sourceId === b.sourceId;

const fields = z.enum(['sources', 'definition']);

export type ProviderSourcesField = z.infer<typeof fields>;

function providerSourcesSchema(part: IndicatorSourcePart) {
  return z
    .array(providerSourceSchema)
    .min(1, `Add at least one data provider for the ${part}`)
    .max(MAX_PROVIDER_SOURCES, `You cannot add more than ${MAX_PROVIDER_SOURCES} data sources`)
    .refine(
      (sources) =>
        sources.every(
          (source, index) =>
            sources.findIndex((other) => sameProviderSource(source, other)) === index,
        ),
      'Select a source that has not already been added',
    );
}

function schemaOf(part: IndicatorSourcePart) {
  return z.object({
    sources: providerSourcesSchema(part),
    definition: z.string().trim().min(1, `Enter the definition of the ${part}`),
  });
}

export type ProviderSources = z.infer<ReturnType<typeof schemaOf>>;

/** The answers as the form holds them: the sources added so far, and the definition as typed. */
export interface ProviderSourcesFormValues {
  sources: ProviderSource[];
  definition: string;
}

/** One of the two sections, keyed by the part of the calculation it asks about. */
export type ProviderSourcesSection = IndicatorSection<
  ProviderSourcesField,
  ProviderSources,
  ProviderSourcesFormValues
> & { key: IndicatorSourcePart };

function providerSourcesSection(part: IndicatorSourcePart): ProviderSourcesSection {
  return { key: part, fields, schema: schemaOf(part) };
}

export const numeratorSection = providerSourcesSection('numerator');

export const denominatorSection = providerSourcesSection('denominator');

/** The draft's answers: no sources until some are added, and no definition until typed. */
export const providerSourcesAnswersSchema = z.object({
  sources: z.array(providerSourceSchema),
  definition: z.string().nullable(),
});

export type ProviderSourcesAnswers = z.infer<typeof providerSourcesAnswersSchema>;

export function providerSourcesFormValues({
  sources,
  definition,
}: ProviderSourcesAnswers): ProviderSourcesFormValues {
  return { sources, definition: definition ?? '' };
}

export function areProviderSourcesComplete(
  section: ProviderSourcesSection,
  answers: ProviderSourcesAnswers,
): boolean {
  return section.schema.safeParse(providerSourcesFormValues(answers)).success;
}

/** The select's value for a provider chosen with no specific source. */
export const NO_SPECIFIC_SOURCE = 'none';

/** The two selects that add a provider and source to the list, as chosen. */
export interface NewProviderSourceFormValues {
  providerId: string;
  sourceId: string;
}

export type NewProviderSourceField = keyof NewProviderSourceFormValues;

export const SELECT_DATA_PROVIDER = 'Select a data provider';

/**
 * The list with the chosen provider and source added at its end, or why they were refused.
 * The choice is checked against the providers offered, which the form's selects only ever
 * send; a refusal of the list itself, such as a repeat, is reported against the source.
 */
export function addProviderSource(
  part: IndicatorSourcePart,
  sources: readonly ProviderSource[],
  { providerId, sourceId }: NewProviderSourceFormValues,
  providers: readonly DataProvider[],
):
  | { sources: ProviderSource[] }
  | { fieldErrors: Partial<Record<NewProviderSourceField, string>> } {
  const provider = providers.find(({ id }) => id === providerId);

  if (provider === undefined) return { fieldErrors: { providerId: SELECT_DATA_PROVIDER } };

  const source = provider.sources.find(({ id }) => id === sourceId);

  if (sourceId !== NO_SPECIFIC_SOURCE && source === undefined) {
    return { fieldErrors: { sourceId: 'Select a source, or No specific source' } };
  }

  const added = providerSourcesSchema(part).safeParse([
    ...sources,
    { providerId, sourceId: source?.id ?? null },
  ]);

  return added.success
    ? { sources: added.data }
    : {
        fieldErrors: {
          sourceId: added.error.issues[0]?.message ?? 'The source could not be added',
        },
      };
}

/** Whether every source names a provider offered and, where named, one of its sources. */
export function areProviderSourcesOffered(
  sources: readonly ProviderSource[],
  providers: readonly DataProvider[],
): boolean {
  return sources.every(({ providerId, sourceId }) => {
    const provider = providers.find(({ id }) => id === providerId);

    return (
      provider !== undefined &&
      (sourceId === null || provider.sources.some(({ id }) => id === sourceId))
    );
  });
}

/** A provider alone where there is no specific source, as the public page shows it too. */
export function providerSourceLabel(
  { providerId, sourceId }: ProviderSource,
  providers: readonly DataProvider[],
): string {
  const provider = providers.find(({ id }) => id === providerId);
  const source = provider?.sources.find(({ id }) => id === sourceId);

  if (provider === undefined) throw new Error(`No provider ${providerId} is offered`);

  return source === undefined ? provider.name : `${provider.name}: ${source.name}`;
}
