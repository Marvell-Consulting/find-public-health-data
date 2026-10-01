import { describe, expect, it } from 'vitest';

import { errorProp } from './error-prop.ts';

describe('errorProp', () => {
  it('gives the error as a prop', () => {
    expect(errorProp('Select an answer')).toEqual({ error: 'Select an answer' });
  });

  it('gives no prop at all when there is no error', () => {
    expect(errorProp(undefined)).toStrictEqual({});
  });
});
