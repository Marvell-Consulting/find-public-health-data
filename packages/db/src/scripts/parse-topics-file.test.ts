import { describe, expect, it } from 'vitest';

import type { TopicRecord } from '../schema/index.js';
import { parseTopicsFile } from './parse-topics-file.js';

const validTopic: TopicRecord = {
  id: '019f93b8-2b47-75d0-b03a-edb28d2d43c6',
  slug: 'alcohol',
  title: 'Alcohol',
  description: 'Alcohol indicators.',
};

describe('parseTopicsFile', () => {
  it('accepts a well-formed file', () => {
    expect(parseTopicsFile([validTopic])).toEqual([validTopic]);
  });

  it('rejects a non-uuid id', () => {
    expect(() => parseTopicsFile([{ ...validTopic, id: 'not-a-uuid' }])).toThrow(/Invalid/);
  });

  it.each(['Alcohol', 'alcohol_use', 'alcohol--use', '-alcohol', 'alcohol-'])(
    'rejects a malformed slug: %s',
    (slug) => {
      expect(() => parseTopicsFile([{ ...validTopic, slug }])).toThrow(/Invalid/);
    },
  );

  it.each(['slug', 'title', 'description'] as const)('rejects an empty %s', (field) => {
    expect(() => parseTopicsFile([{ ...validTopic, [field]: '' }])).toThrow(/Invalid/);
  });

  it('rejects a duplicate id within the file', () => {
    const duplicate = { ...validTopic, slug: 'other-slug' };

    expect(() => parseTopicsFile([validTopic, duplicate])).toThrow(
      new RegExp(`duplicate id: ${validTopic.id}`),
    );
  });

  it('rejects a duplicate slug within the file', () => {
    const duplicate = { ...validTopic, id: '019f93b8-2b47-75d0-b03a-edb3edd0ffbc' };

    expect(() => parseTopicsFile([validTopic, duplicate])).toThrow(
      new RegExp(`duplicate slug: ${validTopic.slug}`),
    );
  });

  it('rejects a value that is not an array', () => {
    expect(() => parseTopicsFile({})).toThrow(/Invalid/);
  });
});
