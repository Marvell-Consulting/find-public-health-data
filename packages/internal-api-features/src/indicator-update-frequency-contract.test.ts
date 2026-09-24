import { UPDATE_FREQUENCIES } from '@fphd/utils/update-frequency';
import { describe, expect, it } from 'vitest';

import { updateFrequencySection as section } from './indicator-update-frequency-contract.ts';
import { sectionFieldErrors } from './testing.ts';

describe('updateFrequencySection', () => {
  it.each(UPDATE_FREQUENCIES)('takes %s', (updateFrequency) => {
    expect(section.schema.parse({ updateFrequency })).toEqual({ updateFrequency });
  });

  it.each([
    { updateFrequency: '' },
    {},
    { updateFrequency: 'fortnightly' },
    { updateFrequency: 'Annual' },
    { updateFrequency: 12 },
  ])('asks how often it will be updated given %o', (body) => {
    expect(sectionFieldErrors(section, body)).toEqual({
      updateFrequency: 'Select how often this indicator will be updated',
    });
  });
});
