import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseIndicatorTopicFile } from './indicator-topic-repository.ts';

function data(path: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf-8'));
}

describe('published demo topic mapping', () => {
  it('covers every topic and retains the curated seed memberships', () => {
    const topics = data('../data/topics.json') as { id: string }[];
    const published = parseIndicatorTopicFile(data('../data/published-indicator-topics.json'));
    const curated = parseIndicatorTopicFile(data('../data/indicator-topics.json'));
    const pairs = published.indicatorTopics.map(
      ({ topicId, fingertipsId }) => `${topicId}:${fingertipsId}`,
    );

    expect(new Set(pairs).size).toBe(pairs.length);
    expect(new Set(published.indicatorTopics.map(({ topicId }) => topicId))).toEqual(
      new Set(topics.map(({ id }) => id)),
    );
    expect(published.indicatorTopics.length).toBeGreaterThan(1_000);
    for (const { topicId, fingertipsId } of curated.indicatorTopics) {
      expect(pairs).toContain(`${topicId}:${fingertipsId}`);
    }
  });
});
