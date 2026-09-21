import { describe, expect, it } from 'vitest';

import { isShortId, MAX_SHORT_ID } from './short-id.ts';

describe('isShortId', () => {
  it.each(['1', '108', '90366', String(MAX_SHORT_ID)])('accepts %s', (value) => {
    expect(isShortId(value)).toBe(true);
  });

  it.each([String(MAX_SHORT_ID + 1), '9999999999', '99999999999999999999'])(
    'refuses %s, which no integer column can hold',
    (value) => {
      expect(isShortId(value)).toBe(false);
    },
  );

  it.each(['', '  108', '108a', '-1', '1.0', 'under-75-mortality'])(
    'refuses %j, which is not a run of digits',
    (value) => {
      expect(isShortId(value)).toBe(false);
    },
  );
});
