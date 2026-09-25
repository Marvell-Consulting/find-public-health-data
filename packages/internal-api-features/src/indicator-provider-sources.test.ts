import { describe, expect, it, vi } from 'vitest';

import { type DataProvider, numeratorSection, toFieldErrors } from './contract.ts';
import {
  denominatorColumns,
  numeratorColumns,
  providerSourcesServerSection,
} from './indicator-provider-sources.ts';
import type { IndicatorSectionDraft } from './indicator-section.ts';
import { createFakeInternalRepositories } from './testing.ts';

const ons: DataProvider = {
  id: '01a0d858-9885-764e-8d53-6826aec67001',
  name: 'Office for National Statistics (ONS)',
  sources: [{ id: '01a0d858-9885-764e-8d53-6826aec67002', name: 'Annual mortality extract' }],
};
const mortality = { providerId: ons.id, sourceId: ons.sources[0]?.id ?? null };
const onsAlone = { providerId: ons.id, sourceId: null };

const draft = {
  numeratorSources: [mortality],
  numeratorDefinition: 'Deaths',
  denominatorSources: [onsAlone],
  denominatorDefinition: 'Population',
} as unknown as IndicatorSectionDraft;

describe('numeratorColumns and denominatorColumns', () => {
  it('read each part from its own sources and definition', () => {
    expect(numeratorColumns.fromDraft(draft)).toEqual({
      sources: [mortality],
      definition: 'Deaths',
    });
    expect(denominatorColumns.fromDraft(draft)).toEqual({
      sources: [onsAlone],
      definition: 'Population',
    });
  });

  it('write the definition as a column and the sources as the list of their part', () => {
    const answers = { sources: [mortality, onsAlone], definition: 'Deaths' };

    expect(numeratorColumns.toAttributes(answers)).toEqual({ numeratorDefinition: 'Deaths' });
    expect(numeratorColumns.toLists?.(answers)).toEqual({ numeratorSources: answers.sources });
    expect(denominatorColumns.toAttributes(answers)).toEqual({ denominatorDefinition: 'Deaths' });
    expect(denominatorColumns.toLists?.(answers)).toEqual({ denominatorSources: answers.sources });
  });
});

describe('providerSourcesServerSection', () => {
  function submit(body: object) {
    const list = vi.fn().mockResolvedValue([ons]);
    const { dataProviders } = createFakeInternalRepositories({ dataProviders: { list } });
    const section = providerSourcesServerSection(numeratorSection, dataProviders);

    return { list, section, submission: section.schema.safeParseAsync(body) };
  }

  it('accepts sources the providers list offers', async () => {
    const body = { sources: [mortality, onsAlone], definition: 'Deaths' };

    expect((await submit(body).submission).data).toEqual(body);
  });

  it('refuses a source the providers list does not offer', async () => {
    const { section, submission } = submit({
      sources: [{ providerId: ons.id, sourceId: '01a0d858-9885-764e-8d53-6826aec67999' }],
      definition: 'Deaths',
    });
    const result = await submission;

    expect(
      result.success ? undefined : toFieldErrors(result.error, section.fields.options),
    ).toEqual({ sources: 'Select a data provider' });
  });

  it('refuses an incomplete form without reading the providers', async () => {
    const { list, submission } = submit({ sources: [], definition: '' });

    expect((await submission).success).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });
});
