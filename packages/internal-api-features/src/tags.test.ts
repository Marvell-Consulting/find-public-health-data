import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { type TagOptions, tagOptionsSchema } from './contract.ts';
import { internalTagsRouter } from './tags.ts';
import {
  createFakeInternalRepositories,
  createRouterTestApp,
  type FakeInternalRepositoryOverrides,
  testSessionCookie,
  testSessionVerifier,
} from './testing.ts';

const path = '/api/internal/tags';

const options: TagOptions = {
  topics: [{ id: '019fa38f-073f-764e-9ac6-1c4d03b10001', name: 'Alcohol' }],
  indicatorTypes: [{ id: '019fa38f-073f-764e-9ac6-1c4d03b10002', name: 'Outcome' }],
  riskFactors: [{ id: '019fa38f-073f-764e-9ac6-1c4d03b10003', name: 'Gambling' }],
  frameworks: [{ id: '019fa38f-073f-764e-9ac6-1c4d03b10004', name: 'Healthy Child' }],
};

function createTestApp(overrides: FakeInternalRepositoryOverrides['tags'] = {}): Express {
  const repositories = createFakeInternalRepositories({ tags: overrides });

  return createRouterTestApp(internalTagsRouter(repositories.tags, testSessionVerifier));
}

describe('GET /api/internal/tags', () => {
  it('answers every list the repository gives, in the shape the contract describes', async () => {
    const response = await request(
      createTestApp({ listOptions: vi.fn().mockResolvedValue(options) }),
    )
      .get(path)
      .set('Cookie', await testSessionCookie(['internal', 'publisher']));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(options);
    expect(tagOptionsSchema.safeParse(response.body).success).toBe(true);
  });

  it('rejects an anonymous request', async () => {
    const response = await request(createTestApp()).get(path);

    expect(response.status).toBe(401);
  });

  it('rejects a signed-in non-publisher', async () => {
    const response = await request(createTestApp())
      .get(path)
      .set('Cookie', await testSessionCookie(['internal']));

    expect(response.status).toBe(403);
  });
});
