import { describe, expect, it } from 'vitest';

import { ADD_INTENT, addIntent, readListIntent, readListItems, removeIntent } from './list-form.ts';

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
    [{ intent: 'add-1' }, { to: 'continue' }],
  ])('reads the button that sent %o', (fields, intent) => {
    expect(readListIntent(formData(fields))).toEqual(intent);
  });

  it.each([
    [{ intent: addIntent('topics') }, { to: 'add', list: 'topics' }],
    [{ intent: removeIntent(2, 'frameworks') }, { to: 'remove', index: 2, list: 'frameworks' }],
    [{ intent: 'remove-topics' }, { to: 'continue' }],
    [{ intent: addIntent('unknown') }, { to: 'continue' }],
  ])('reads the list a button names on a form with several: %o', (fields, intent) => {
    expect(readListIntent(formData(fields), ['topics', 'frameworks'])).toEqual(intent);
  });
});

describe('readListItems', () => {
  const name = (index: number, part: string) => `items[${index}].${part}`;

  it('reads each item in order until one is missing, a part not sent being empty', () => {
    const data = formData({
      'items[0].url': 'https://a.test',
      'items[0].text': 'A',
      'items[1].url': 'https://b.test',
      'items[3].url': 'https://d.test',
    });

    expect(readListItems(data, ['url', 'text'], name)).toEqual([
      { url: 'https://a.test', text: 'A' },
      { url: 'https://b.test', text: '' },
    ]);
  });

  it('reads no items from a form carrying none', () => {
    expect(readListItems(formData({ 'items[0].text': 'A' }), ['url', 'text'], name)).toEqual([]);
  });
});
