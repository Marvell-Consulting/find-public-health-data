import { describe, expect, it } from 'vitest';

import {
  definitionAndRationaleSection,
  indicatorCreateErrorSchema,
  indicatorFieldSchema,
  indicatorNameSchema,
  indicatorSectionErrorSchema,
  indicatorTaskListSchema,
  indicatorUpdateErrorSchema,
  toFieldErrors,
  topicFieldSchema,
  topicUpdateErrorSchema,
  topicUpdateSchema,
} from './contract.ts';

describe('indicatorNameSchema', () => {
  it('takes the name as typed, without its surrounding spaces', () => {
    const result = indicatorNameSchema.safeParse({ name: '  Life expectancy at birth  ' });

    expect(result.success && result.data).toEqual({ name: 'Life expectancy at birth' });
  });

  it.each(['', '   '])('asks for a name when %o is submitted', (name) => {
    const result = indicatorNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error, indicatorFieldSchema.options)).toEqual({
      name: 'Enter the name of the indicator',
    });
  });

  it.each(['108', ' 2024 ', '2,024'])('refuses %o, which would read as a short id', (name) => {
    const result = indicatorNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error, indicatorFieldSchema.options)).toEqual({
      name: 'Enter a name that is not only numbers',
    });
  });

  it.each(['!!!', '???  %%%'])('refuses %o, which leaves no slug at all', (name) => {
    const result = indicatorNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error, indicatorFieldSchema.options)).toEqual({
      name: 'Enter a name that includes letters or numbers',
    });
  });

  it.each(['search', 'Compare', 'facets'])('refuses %o, which the service uses', (name) => {
    const result = indicatorNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error, indicatorFieldSchema.options)).toEqual({
      name: 'Enter a different name, this one is reserved for the service',
    });
  });

  it.each(['Covid-19 deaths', '2024 births', 'Obesity', 'life-expectancy'])(
    'accepts %o',
    (name) => {
      expect(indicatorNameSchema.safeParse({ name }).success).toBe(true);
    },
  );

  it('accepts a name of 300 characters, measured once trimmed', () => {
    const name = ` ${'a'.repeat(300)} `;

    expect(indicatorNameSchema.safeParse({ name }).success).toBe(true);
  });

  it('refuses a name of 301 characters', () => {
    const result = indicatorNameSchema.safeParse({ name: 'a'.repeat(301) });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error, indicatorFieldSchema.options)).toEqual({
      name: 'Indicator name must be 300 characters or fewer',
    });
  });

  it('rejects a submission with no name at all', () => {
    expect(indicatorNameSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a name that is not text', () => {
    expect(indicatorNameSchema.safeParse({ name: 108 }).success).toBe(false);
  });
});

describe('toFieldErrors', () => {
  function topicErrors(submission: unknown) {
    const result = topicUpdateSchema.safeParse(submission);
    if (result.success) throw new Error('expected the submission to be refused');
    return toFieldErrors(result.error, topicFieldSchema.options);
  }

  it('reports one message per field, in the order the schema states them', () => {
    expect(topicErrors({ title: '', slug: 'Not A Slug', description: '' })).toEqual({
      title: 'Enter a topic name',
      slug: 'Slug must be lowercase letters or numbers, separated by hyphens',
      description: 'Enter a description',
    });
  });

  it('keeps the first message when a value breaks two rules', () => {
    expect(topicErrors({ title: 'A topic', slug: '', description: 'About it.' })).toEqual({
      slug: 'Enter a slug',
    });
  });

  it('drops an issue on a field the form does not show', () => {
    const result = topicUpdateSchema.safeParse({ title: '', slug: 'a-slug', description: 'A.' });
    if (result.success) throw new Error('expected the submission to be refused');
    const [reported] = result.error.issues;
    if (reported === undefined) throw new Error('expected an issue to copy');
    result.error.issues.push({ ...reported, path: ['unknown'] });

    expect(toFieldErrors(result.error, topicFieldSchema.options)).toEqual({
      title: 'Enter a topic name',
    });
  });
});

describe.each([
  ['topicUpdateErrorSchema', topicUpdateErrorSchema, ['validation_failed', 'slug_taken']],
  ['indicatorCreateErrorSchema', indicatorCreateErrorSchema, ['validation_failed', 'slug_taken']],
  ['indicatorUpdateErrorSchema', indicatorUpdateErrorSchema, ['validation_failed', 'slug_taken']],
  [
    'indicatorSectionErrorSchema',
    indicatorSectionErrorSchema(definitionAndRationaleSection.fields),
    ['validation_failed'],
  ],
])('%s', (_name, schema, refusals) => {
  it.each(refusals)('requires %s to name its fields', (error) => {
    expect(schema.safeParse({ error }).success).toBe(false);
    expect(schema.safeParse({ error, fieldErrors: {} }).success).toBe(true);
  });
});

describe('invalid_id', () => {
  it.each([
    topicUpdateErrorSchema,
    indicatorUpdateErrorSchema,
    indicatorSectionErrorSchema(definitionAndRationaleSection.fields),
  ])('is accepted with no fields, as no field is at fault', (schema) => {
    expect(schema.safeParse({ error: 'invalid_id' }).success).toBe(true);
  });
});

describe('indicatorTaskListSchema', () => {
  const state = {
    indicator: {
      id: '00000000-0000-7000-8000-000000000001',
      shortId: 90366,
      name: 'An indicator',
      indicatorStatus: 'new',
      draftStatus: 'draft',
    },
    isUpdate: false,
    canSubmit: true,
    tasks: { name: 'completed' },
  };

  it('accepts a state naming only the tasks that exist', () => {
    const result = indicatorTaskListSchema.safeParse({ ...state, tasks: {} });

    expect(result.success && result.data.tasks).toEqual({});
  });

  it.each(['not_started', 'completed'])('accepts a task status of %s', (status) => {
    expect(indicatorTaskListSchema.safeParse({ ...state, tasks: { name: status } }).success).toBe(
      true,
    );
  });

  it('refuses a status the vocabulary does not hold yet', () => {
    expect(
      indicatorTaskListSchema.safeParse({ ...state, tasks: { name: 'incomplete' } }).success,
    ).toBe(false);
  });

  it('refuses a task the API does not judge', () => {
    expect(
      indicatorTaskListSchema.safeParse({ ...state, tasks: { 'not-a-task': 'completed' } }).success,
    ).toBe(false);
  });

  it('requires the indicator the tasks belong to', () => {
    const { indicator: _indicator, ...withoutIndicator } = state;

    expect(indicatorTaskListSchema.safeParse(withoutIndicator).success).toBe(false);
  });
});
