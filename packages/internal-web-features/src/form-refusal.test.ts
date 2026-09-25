import { describe, expect, it } from 'vitest';

import { FORM_NOT_SAVED, formRefusal } from './form-refusal.ts';

describe('formRefusal', () => {
  it('passes on the fields the API named, with no message for the form', () => {
    expect(
      formRefusal({ error: 'slug_taken', fieldErrors: { slug: 'This slug is already used' } }),
    ).toEqual({ fieldErrors: { slug: 'This slug is already used' } });
  });

  it.each([
    ['an id', { error: 'invalid_id' }],
    ['no field', { error: 'validation_failed', fieldErrors: {} }],
  ])('says the form was not saved when the refusal names %s', (_case, refusal) => {
    expect(formRefusal(refusal)).toEqual({ fieldErrors: {}, formError: FORM_NOT_SAVED });
  });
});
