import { describe, expect, it } from 'vitest';

import { ADD_INTENT, readListIntent, removeIntent } from './list-form.ts';

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

describe('readListIntent', () => {
  it.each([
    [{ intent: ADD_INTENT }, { to: 'add' }],
    [{ intent: removeIntent(1) }, { to: 'remove', index: 1 }],
    [{}, { to: 'continue' }],
    [{ intent: 'something-else' }, { to: 'continue' }],
    [{ intent: 'remove-' }, { to: 'continue' }],
  ])('reads the button that sent %o', (fields, intent) => {
    expect(readListIntent(formData(fields))).toEqual(intent);
  });
});
