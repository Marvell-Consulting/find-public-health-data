import { POLARITIES } from '@fphd/utils/polarity';
import { UPDATE_FREQUENCIES } from '@fphd/utils/update-frequency';
import { describe, expect, it } from 'vitest';

import {
  PHOLIO_FREQUENCIES,
  PHOLIO_POLARITIES,
  translateFrequency,
  translatePolarity,
} from './fingertips-lookups.ts';

describe('translatePolarity', () => {
  it('gives each Fingertips polarity a service value', () => {
    expect(
      Object.fromEntries(Object.keys(PHOLIO_POLARITIES).map((n) => [n, translatePolarity(n)])),
    ).toEqual({
      'RAG - High is good': 'higher-is-better',
      'RAG - Low is good': 'lower-is-better',
      'BOB - Blue orange blue': 'no-polarity',
      'Not applicable': 'no-comparison-possible',
    });
  });

  it('refuses a polarity it has no value for', () => {
    expect(() => translatePolarity('RAG - Middle is good')).toThrow('RAG - Middle is good');
  });

  it('translates to values the service holds', () => {
    for (const value of Object.values(PHOLIO_POLARITIES)) expect(POLARITIES).toContain(value);
  });
});

describe('translateFrequency', () => {
  it('gives each Fingertips frequency a service value', () => {
    expect(
      Object.fromEntries(Object.keys(PHOLIO_FREQUENCIES).map((n) => [n, translateFrequency(n)])),
    ).toEqual({
      Annual: 'annually',
      'Monthly (not yet in use)': 'monthly',
      'Quarterly (not yet in use)': 'quarterly',
    });
  });

  it('refuses a frequency it has no value for', () => {
    expect(() => translateFrequency('Fortnightly')).toThrow('Fortnightly');
  });

  it('translates to values the service holds', () => {
    for (const value of Object.values(PHOLIO_FREQUENCIES)) {
      expect(UPDATE_FREQUENCIES).toContain(value);
    }
  });
});
