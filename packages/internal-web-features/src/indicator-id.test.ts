import { describe, expect, it } from 'vitest';

import { requireIndicatorId } from './indicator-id.ts';

describe('requireIndicatorId', () => {
  it('returns the id the address names', () => {
    const id = '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b';

    expect(requireIndicatorId({ id })).toBe(id);
  });

  it.each([
    ['a short id', '90366'],
    ['a slug', 'life-expectancy-at-birth'],
    ['no id', undefined],
  ])('throws a 404 for %s', (_, id) => {
    expect(() => requireIndicatorId({ id })).toThrow(expect.objectContaining({ status: 404 }));
  });
});
