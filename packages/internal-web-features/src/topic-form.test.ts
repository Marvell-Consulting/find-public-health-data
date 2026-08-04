import { describe, expect, it } from 'vitest';

import { parseTopicForm, readTopicForm } from './topic-form';

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.append(name, value);
  return data;
}

const valid = { title: 'Air quality', slug: 'air-quality', description: 'About air quality.' };

describe('readTopicForm', () => {
  it('returns what was typed, untrimmed, so the form can be re-rendered as submitted', () => {
    expect(readTopicForm(formData({ ...valid, title: '  Air quality  ' }))).toEqual({
      ...valid,
      title: '  Air quality  ',
    });
  });

  it('treats a field the browser did not send as empty', () => {
    expect(readTopicForm(new FormData())).toEqual({ title: '', slug: '', description: '' });
  });
});

describe('parseTopicForm', () => {
  it('accepts a valid submission and trims it', () => {
    expect(parseTopicForm(formData({ ...valid, description: ' About air quality. ' }))).toEqual({
      ok: true,
      values: valid,
    });
  });

  it.each([
    ['an empty name', { title: '' }, { title: 'Enter a topic name' }],
    ['a whitespace-only name', { title: '   ' }, { title: 'Enter a topic name' }],
    ['an empty description', { description: '' }, { description: 'Enter a description' }],
    ['an empty slug', { slug: '' }, { slug: 'Enter a slug' }],
    [
      'a slug with spaces',
      { slug: 'air quality' },
      { slug: 'Slug must be lowercase letters or numbers, separated by hyphens' },
    ],
    [
      'an uppercase slug',
      { slug: 'Air-Quality' },
      { slug: 'Slug must be lowercase letters or numbers, separated by hyphens' },
    ],
  ])('rejects %s', (_case, change, fieldErrors) => {
    expect(parseTopicForm(formData({ ...valid, ...change }))).toEqual({ ok: false, fieldErrors });
  });

  it('reports every invalid field at once, so the summary lists them all', () => {
    expect(parseTopicForm(formData({ title: '', slug: 'Not A Slug', description: '' }))).toEqual({
      ok: false,
      fieldErrors: {
        title: 'Enter a topic name',
        slug: 'Slug must be lowercase letters or numbers, separated by hyphens',
        description: 'Enter a description',
      },
    });
  });

  it('gives a field one message even when it breaks two rules', () => {
    const result = parseTopicForm(formData({ ...valid, slug: '' }));

    expect(result).toEqual({ ok: false, fieldErrors: { slug: 'Enter a slug' } });
  });
});
