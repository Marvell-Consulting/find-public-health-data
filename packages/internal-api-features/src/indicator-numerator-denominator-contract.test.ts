import { describe, expect, it } from 'vitest';

import {
  addProviderSource,
  areProviderSourcesComplete,
  areProviderSourcesOffered,
  type DataProvider,
  denominatorSection,
  MAX_PROVIDER_SOURCES,
  NO_SPECIFIC_SOURCE,
  numeratorSection,
  type ProviderSource,
  providerSourceLabel,
} from './indicator-numerator-denominator-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const providers: DataProvider[] = [
  {
    id: '01a0d858-9885-764e-8d53-6826aec67001',
    name: 'Office for National Statistics (ONS)',
    sources: [
      { id: '01a0d858-9885-764e-8d53-6826aec67002', name: 'Annual mortality extract' },
      { id: '01a0d858-9885-764e-8d53-6826aec67003', name: 'Mid-year population estimates' },
    ],
  },
  { id: '01a0d858-9885-764e-8d53-6826aec67004', name: 'Estimated', sources: [] },
];

const [ons, estimated] = providers as [DataProvider, DataProvider];
const mortality: ProviderSource = { providerId: ons.id, sourceId: ons.sources[0]?.id ?? null };
const onsAlone: ProviderSource = { providerId: ons.id, sourceId: null };

/** As many distinct sources as the list may hold. */
const fullList: ProviderSource[] = Array.from({ length: MAX_PROVIDER_SOURCES }, (_, index) => ({
  providerId: `01a0d858-9885-764e-8d53-${String(index).padStart(12, '0')}`,
  sourceId: null,
}));

describe('numeratorSection', () => {
  it('takes the sources in the order given and the definition without its surrounding spaces', () => {
    expect(
      numeratorSection.schema.parse({ sources: [mortality, onsAlone], definition: ' Deaths\n' }),
    ).toEqual({ sources: [mortality, onsAlone], definition: 'Deaths' });
  });

  it.each([
    [
      { sources: [], definition: '' },
      {
        sources: 'Add at least one data provider for the numerator',
        definition: 'Enter the definition of the numerator',
      },
    ],
    [
      { sources: [mortality, mortality], definition: 'Deaths' },
      { sources: 'Select a source that has not already been added' },
    ],
    [
      { sources: [...fullList, mortality], definition: 'Deaths' },
      { sources: 'You cannot add more than 20 data sources' },
    ],
    [
      { sources: [mortality], definition: '  ' },
      { definition: 'Enter the definition of the numerator' },
    ],
  ])('refuses %j', (answers, fieldErrors) => {
    expect(sectionFieldErrors(numeratorSection, answers)).toEqual(fieldErrors);
  });
});

describe('denominatorSection', () => {
  it('asks the same of the denominator, in its own words', () => {
    expect(denominatorSection.key).toBe('denominator');
    expect(sectionFieldErrors(denominatorSection, { sources: [], definition: '' })).toEqual({
      sources: 'Add at least one data provider for the denominator',
      definition: 'Enter the definition of the denominator',
    });
  });
});

describe('areProviderSourcesComplete', () => {
  it('holds a section complete once it has sources and a definition', () => {
    expect(
      areProviderSourcesComplete(numeratorSection, { sources: [mortality], definition: 'Deaths' }),
    ).toBe(true);
    expect(
      areProviderSourcesComplete(numeratorSection, { sources: [mortality], definition: null }),
    ).toBe(false);
  });
});

describe('addProviderSource', () => {
  it('adds a provider with one of its sources at the end of the list', () => {
    expect(
      addProviderSource(
        'numerator',
        [onsAlone],
        { providerId: ons.id, sourceId: mortality.sourceId ?? '' },
        providers,
      ),
    ).toEqual({ sources: [onsAlone, mortality] });
  });

  it('adds a provider with no specific source', () => {
    expect(
      addProviderSource(
        'numerator',
        [],
        { providerId: estimated.id, sourceId: NO_SPECIFIC_SOURCE },
        providers,
      ),
    ).toEqual({ sources: [{ providerId: estimated.id, sourceId: null }] });
  });

  it.each([
    ['no provider', { providerId: '', sourceId: '' }, { providerId: 'Select a data provider' }],
    [
      'a provider not offered',
      { providerId: '01a0d858-9885-764e-8d53-6826aec67999', sourceId: NO_SPECIFIC_SOURCE },
      { providerId: 'Select a data provider' },
    ],
    [
      'no source',
      { providerId: ons.id, sourceId: '' },
      { sourceId: 'Select a source, or No specific source' },
    ],
    [
      "another provider's source",
      { providerId: estimated.id, sourceId: mortality.sourceId ?? '' },
      { sourceId: 'Select a source, or No specific source' },
    ],
    [
      'a source already added',
      { providerId: ons.id, sourceId: mortality.sourceId ?? '' },
      { sourceId: 'Select a source that has not already been added' },
    ],
  ])('refuses %s', (_, choice, fieldErrors) => {
    expect(addProviderSource('numerator', [mortality], choice, providers)).toEqual({ fieldErrors });
  });
});

describe('areProviderSourcesOffered', () => {
  it.each([
    [[mortality, onsAlone], true],
    [[{ providerId: estimated.id, sourceId: mortality.sourceId }], false],
    [[{ providerId: '01a0d858-9885-764e-8d53-6826aec67999', sourceId: null }], false],
  ])('judges %j as offered: %s', (sources, offered) => {
    expect(areProviderSourcesOffered(sources, providers)).toBe(offered);
  });
});

describe('providerSourceLabel', () => {
  it('names the provider and its source, or the provider alone', () => {
    expect(providerSourceLabel(mortality, providers)).toBe(
      'Office for National Statistics (ONS): Annual mortality extract',
    );
    expect(providerSourceLabel(onsAlone, providers)).toBe('Office for National Statistics (ONS)');
  });
});
