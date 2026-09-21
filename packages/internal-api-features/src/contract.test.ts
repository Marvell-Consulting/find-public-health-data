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

  it.each(['108', ' 2024 ', '2,024'])('refuses %o, which would read as a short id', (name) => {
    const result = indicatorNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error)).toEqual({
      name: 'Enter a name that is not only numbers',
    });
  });

  it.each(['!!!', '???  %%%'])('refuses %o, which leaves no slug at all', (name) => {
    const result = indicatorNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error)).toEqual({
      name: 'Enter a name that includes letters or numbers',
    });
  });

  it.each(['search', 'Compare', 'facets'])('refuses %o, which the service uses', (name) => {
    const result = indicatorNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error)).toEqual({
      name: 'Enter a different name, this one is reserved for the service',
    });
  });

  it.each(['Obesity', 'life-expectancy', ' Smoking '])(
    'asks for more than one word for %o',
    (name) => {
      const result = indicatorNameSchema.safeParse({ name });

      expect(result.success).toBe(false);
      expect(!result.success && toFieldErrors(result.error)).toEqual({
        name: 'Enter a name with more than one word',
      });
    },
  );

  it.each(['Covid-19 deaths', '2024 births'])('accepts %o', (name) => {
    expect(indicatorNameSchema.safeParse({ name }).success).toBe(true);
  });

  it('rejects a submission with no name at all', () => {
    expect(indicatorNameSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a name that is not text', () => {
    expect(indicatorNameSchema.safeParse({ name: 108 }).success).toBe(false);
  });
});
