import { describe, expect, it } from 'vitest';

import { isIndicatorSegment } from './paths.ts';

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
    'a'.repeat(81),
    'no_such',
  ])('refuses %s without asking the API', (segment) => {
    expect(isIndicatorSegment(segment)).toBe(false);
  });
});
