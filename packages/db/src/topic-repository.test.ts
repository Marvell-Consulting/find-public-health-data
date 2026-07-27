import { describe, expect, it } from 'vitest';

import type { TopicRecord } from './schema/index.js';
import { findOrphanedTopics, summarizeUpsert } from './topic-repository.js';

const validTopic: TopicRecord = {
  id: '019f93b8-2b47-75d0-b03a-edb28d2d43c6',
  slug: 'alcohol',
  title: 'Alcohol',
  description: 'Alcohol indicators.',
};

describe('findOrphanedTopics', () => {
  it('reports rows present in the database but absent from the file', () => {
    const inFile: TopicRecord = validTopic;
    const orphan = { id: 'other-id', slug: 'other', title: 'Other', description: 'Other.' };

    expect(findOrphanedTopics([inFile], [inFile, orphan])).toEqual([orphan]);
  });

  it('reports nothing when every database row is present in the file', () => {
    expect(findOrphanedTopics([validTopic], [validTopic])).toEqual([]);
  });
});

describe('summarizeUpsert', () => {
  it('counts inserted and updated rows, and derives unchanged from the remainder', () => {
    expect(
      summarizeUpsert(5, [
        { id: '1', wasInsert: true },
        { id: '2', wasInsert: true },
        { id: '3', wasInsert: false },
      ]),
    ).toEqual({ inserted: 2, updated: 1, unchanged: 2 });
  });

  it('reports every row as unchanged when the database returns nothing', () => {
    expect(summarizeUpsert(3, [])).toEqual({ inserted: 0, updated: 0, unchanged: 3 });
  });
});
