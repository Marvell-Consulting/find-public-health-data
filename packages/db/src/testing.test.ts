import { describe, expect, it } from 'vitest';

import { topic } from './schema.ts';
import { nullColumns } from './testing.ts';

describe('nullColumns', () => {
  it('gives every column of the table, and nothing else, as null', () => {
    expect(nullColumns(topic)).toEqual({
      id: null,
      slug: null,
      title: null,
      description: null,
      createdAt: null,
      updatedAt: null,
    });
  });
});
