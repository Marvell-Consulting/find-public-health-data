import { describe, expect, it } from 'vitest';

import { normalizeReturnTo } from './return-to.ts';

describe('normalizeReturnTo', () => {
  it('retains local paths, query strings and fragments', () => {
    expect(normalizeReturnTo('/manage?view=drafts#latest')).toBe('/manage?view=drafts#latest');
  });

  it.each([
    'https://example.com',
    '//example.com/path',
    '/..//example.com/path',
    '/.//example.com/path',
    '',
    undefined,
    null,
  ])('rejects an external or invalid target', (target) => {
    expect(normalizeReturnTo(target, '/fallback')).toBe('/fallback');
  });
});
