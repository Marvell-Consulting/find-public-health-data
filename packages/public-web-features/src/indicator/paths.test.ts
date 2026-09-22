import { describe, expect, it } from 'vitest';

import { isIndicatorSegment, redirectStatus } from './paths.ts';

describe('redirectStatus', () => {
  it.each(['108', 'Under-75-Mortality', 'UNDER-75-MORTALITY'])(
    '301s %s, an address that can never be canonical',
    (segment) => {
      expect(redirectStatus(segment, 'under-75-mortality')).toBe(301);
    },
  );

  it('302s a superseded slug, which the indicator may take back', () => {
    expect(redirectStatus('an-earlier-name', 'under-75-mortality')).toBe(302);
  });
});

describe('isIndicatorSegment', () => {
  it.each(['108', '2147483647', 'under-75-mortality', 'Under-75-Mortality'])(
    'accepts %s, a short id or a slug in any case',
    (segment) => {
      expect(isIndicatorSegment(segment)).toBe(true);
    },
  );

  it.each([
    '2147483648',
    '9999999999',
    '12345678901',
    '-leading',
    'trailing-',
    'two--hyphens',
    'a'.repeat(201),
    'no_such',
    'search',
    'facets',
    'Compare',
  ])('refuses %s without asking the API', (segment) => {
    expect(isIndicatorSegment(segment)).toBe(false);
  });
});
