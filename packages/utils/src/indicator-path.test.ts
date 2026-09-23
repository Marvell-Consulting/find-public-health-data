import { describe, expect, it } from 'vitest';

import { indicatorPath } from './indicator-path.ts';

describe('indicatorPath', () => {
  it('addresses the indicator page by slug', () => {
    expect(indicatorPath('under-75-mortality')).toBe('/indicators/under-75-mortality');
  });

  it('encodes a slug that would otherwise change the path', () => {
    expect(indicatorPath('a/b?c')).toBe('/indicators/a%2Fb%3Fc');
  });
});
