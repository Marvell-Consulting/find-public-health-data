import type { Database } from '@fphd/db';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp, type TopicSummary, type TopicsReader } from './app.js';

const topicA = {
  slug: 'topic-a',
  title: 'Topic A',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

const topicB = {
  slug: 'topic-b',
  title: 'Topic B',
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
  updatedAt: new Date('2024-02-02T00:00:00.000Z'),
};

function fakeTopics(items: TopicSummary[]): TopicsReader {
  return { list: async () => items };
}

// Routes under test never touch the database; integration tests cover the real one.
const db = {} as Database;

describe('public API', () => {
  it('reports its health', async () => {
    const response = await request(createApp({ db, topics: fakeTopics([]) })).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'public-api' });
  });

  it('does not expose the internal surface', async () => {
    const response = await request(createApp({ db, topics: fakeTopics([]) })).get('/api/internal');

    expect(response.status).toBe(404);
  });

  it('lists topics in the order the repository returns them, as ISO timestamps', async () => {
    const response = await request(createApp({ db, topics: fakeTopics([topicA, topicB]) })).get(
      '/api/topics',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        slug: 'topic-a',
        title: 'Topic A',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
      {
        slug: 'topic-b',
        title: 'Topic B',
        createdAt: '2024-02-01T00:00:00.000Z',
        updatedAt: '2024-02-02T00:00:00.000Z',
      },
    ]);
  });

  it('returns a 500 when the repository fails', async () => {
    const failing: TopicsReader = {
      list: () => Promise.reject(new Error('database unavailable')),
    };

    const response = await request(createApp({ db, topics: failing })).get('/api/topics');

    expect(response.status).toBe(500);
  });
});
