import type { Topic } from '@fphd/db';
import { createFakeRepositories } from '@fphd/db/testing';
import { createLogger } from '@fphd/logger';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

const logger = createLogger({ name: 'public-api', level: 'silent' });

const topic: Topic = {
  id: '00000000-0000-7000-8000-000000000001',
  slug: 'topic-a',
  title: 'Topic A',
  description: 'All about topic A.',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

function createTestApp(repositories = createFakeRepositories()) {
  return createApp({ logger, repositories });
}

describe('public API', () => {
  it('reports its health', async () => {
    const response = await request(createTestApp()).get('/livez');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'public-api' });
  });

  it('describes itself as the public surface', async () => {
    const response = await request(createTestApp()).get('/api');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ audience: 'public' });
  });

  // Every internal path, not just the root one: `internal-api` mounts a router the public
  // app must never gain, and a 404 here is the only mechanical check that it has not.
  it.each([
    ['get', '/api/internal'],
    ['get', '/api/internal/topics'],
    ['post', '/api/internal/topics'],
    ['get', `/api/internal/topics/${topic.id}`],
    ['put', `/api/internal/topics/${topic.id}`],
    ['delete', `/api/internal/topics/${topic.id}`],
  ] as const)('does not expose the internal surface at %s %s', async (method, path) => {
    const response = await request(createTestApp())[method](path);

    expect(response.status).toBe(404);
  });

  // One request per resource: the routers' own behaviour is tested in
  // `@fphd/public-api-features`, so these only pin that each is mounted.
  it('mounts the public topics surface', async () => {
    const repositories = createFakeRepositories({ topics: { list: async () => [topic] } });

    const response = await request(createTestApp(repositories)).get('/api/topics');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        slug: 'topic-a',
        title: 'Topic A',
        description: 'All about topic A.',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]);
  });

  it('mounts the public indicators surface', async () => {
    const repositories = createFakeRepositories({ indicators: { listApproved: async () => [] } });

    const response = await request(createTestApp(repositories)).get('/api/indicators');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ indicators: [] });
  });

  it('mounts the public areas surface', async () => {
    const repositories = createFakeRepositories({
      areas: { listByType: async () => [{ code: 'E12000001', name: 'North East region' }] },
    });

    const response = await request(createTestApp(repositories)).get(
      `/api/areas?area_type=${encodeURIComponent('Regions (statistical)')}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        areaType: 'Regions (statistical)',
        areas: [{ code: 'E12000001', name: 'North East region' }],
      },
    ]);
  });

  it('answers an unknown path with the standard not-found body', async () => {
    const response = await request(createTestApp()).get('/api/nowhere');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('returns a 500 when the repository fails', async () => {
    const repositories = createFakeRepositories({
      topics: { list: () => Promise.reject(new Error('database unavailable')) },
    });

    const response = await request(createTestApp(repositories)).get('/api/topics');

    expect(response.status).toBe(500);
  });

  it('fails loudly when a route reaches for a repository the test did not stub', async () => {
    const response = await request(createTestApp()).get('/api/topics');

    expect(response.status).toBe(500);
  });
});
