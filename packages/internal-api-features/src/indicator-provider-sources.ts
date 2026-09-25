import { z } from '@fphd/config/zod';

import {
  areProviderSourcesOffered,
  type ProviderSources,
  type ProviderSourcesAnswers,
  type ProviderSourcesField,
  type ProviderSourcesSection,
  SELECT_DATA_PROVIDER,
} from './contract.ts';
import type { IndicatorSectionColumns } from './indicator-section.ts';
import type { InternalDataProviderRepository } from './repositories.ts';

export const numeratorColumns: IndicatorSectionColumns<
  ProviderSourcesField,
  ProviderSources,
  ProviderSourcesAnswers
> = {
  fromDraft: (draft) => ({
    sources: draft.numeratorSources,
    definition: draft.numeratorDefinition,
  }),
  toAttributes: ({ definition }) => ({ numeratorDefinition: definition }),
  toLists: ({ sources }) => ({ numeratorSources: sources }),
};

export const denominatorColumns: IndicatorSectionColumns<
  ProviderSourcesField,
  ProviderSources,
  ProviderSourcesAnswers
> = {
  fromDraft: (draft) => ({
    sources: draft.denominatorSources,
    definition: draft.denominatorDefinition,
  }),
  toAttributes: ({ definition }) => ({ denominatorDefinition: definition }),
  toLists: ({ sources }) => ({ denominatorSources: sources }),
};

/** The form's schema, then that every source is one the providers list offers. */
export function providerSourcesServerSection(
  section: ProviderSourcesSection,
  dataProviders: InternalDataProviderRepository,
): ProviderSourcesSection {
  return {
    ...section,
    schema: section.schema.transform(async (answers, ctx) => {
      if (areProviderSourcesOffered(answers.sources, await dataProviders.list())) return answers;

      ctx.addIssue({ code: 'custom', path: ['sources'], message: SELECT_DATA_PROVIDER });
      return z.NEVER;
    }),
  };
}
