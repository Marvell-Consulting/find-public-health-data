import { describe, expect, it } from 'vitest';

import { indicatorNameSchema, toFieldErrors } from './contract.ts';

describe('indicatorNameSchema', () => {
  it('takes the name as typed, without its surrounding spaces', () => {
    const result = indicatorNameSchema.safeParse({ name: '  Life expectancy at birth  ' });

    expect(result.success && result.data).toEqual({ name: 'Life expectancy at birth' });
  });

  it.each(['', '   '])('asks for a name when %o is submitted', (name) => {
    const result = indicatorNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error)).toEqual({
      name: 'Enter the name of the indicator',
    });
  });

  it('rejects a submission with no name at all', () => {
    expect(indicatorNameSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a name that is not text', () => {
    expect(indicatorNameSchema.safeParse({ name: 108 }).success).toBe(false);
  });
});
