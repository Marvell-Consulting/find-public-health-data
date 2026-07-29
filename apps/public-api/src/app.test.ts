import { createFakeRepositories } from '@fphd/db/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

const topicA = {
  id: '00000000-0000-7000-8000-000000000001',
  slug: 'topic-a',
  title: 'Topic A',
  description: 'All about topic A.',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

const topicB = {
  id: '00000000-0000-7000-8000-000000000002',
  slug: 'topic-b',
  title: 'Topic B',
  description: 'All about topic B.',
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
  updatedAt: new Date('2024-02-02T00:00:00.000Z'),
};

describe('public API', () => {
  it('reports its health', async () => {
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/health',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'public-api' });
  });

  it('does not expose the internal surface', async () => {
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/api/internal',
    );

    expect(response.status).toBe(404);
  });

  it('lists topics in the order the repository returns them, as ISO timestamps', async () => {
    const repositories = createFakeRepositories({
      topics: { list: async () => [topicA, topicB] },
    });

    const response = await request(createApp({ repositories })).get('/api/topics');

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

  it('does not leak the internal row id in a topic listing', async () => {
    const repositories = createFakeRepositories({ topics: { list: async () => [topicA] } });

    const response = await request(createApp({ repositories })).get('/api/topics');

    expect(response.body[0]).not.toHaveProperty('id');
  });

  it('returns a 500 when the repository fails', async () => {
    const repositories = createFakeRepositories({
      topics: { list: () => Promise.reject(new Error('database unavailable')) },
    });

    const response = await request(createApp({ repositories })).get('/api/topics');

    expect(response.status).toBe(500);
  });

  it('fails loudly when a route reaches for a repository the test did not stub', async () => {
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/api/topics',
    );

    expect(response.status).toBe(500);
  });
});
