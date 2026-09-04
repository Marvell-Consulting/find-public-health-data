import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Topic } from '@fphd/db';
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createFakeInternalRepositories, type FakeInternalRepositoryOverrides } from './testing.js';
import { internalTopicsRouter } from './topics.js';

const session = createJwtSessionService({
  audience: 'fphd-internal',
  clock: () => new Date('2026-08-04T10:00:00.000Z'),
  cookieName: 'fphd-internal-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});
const verifier = createJwtSessionVerifier(session);

const topic: Topic = {
  id: '00000000-0000-7000-8000-000000000001',
  slug: 'topic-a',
  title: 'Topic A',
  description: 'All about topic A.',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const validSubmission = { title: 'Topic A', slug: 'topic-a', description: 'All about topic A.' };

// The router alone, on a bare Express app: these tests cover its status mapping, not what
// `createApiApp` wraps around it.
function createTestApp(overrides: FakeInternalRepositoryOverrides['topics'] = {}): Express {
  const repositories = createFakeInternalRepositories({ topics: overrides });
  const app = express();

  app.use(express.json());
  app.use(internalTopicsRouter(repositories.topics, verifier));

  return app;
}

async function publisherCookie(roles: readonly string[] = ['internal', 'publisher']) {
  const token = await session.issueToken({ expiresInSeconds: 900, roles, subject: 'test-user' });
  return session.createCookieHeader(token, 900);
}

describe('the internal topics surface', () => {
  const paths = [
    ['get', '/api/internal/topics'],
    ['post', '/api/internal/topics'],
    ['get', `/api/internal/topics/${topic.id}`],
    ['put', `/api/internal/topics/${topic.id}`],
    ['delete', `/api/internal/topics/${topic.id}`],
  ] as const;

  it.each(paths)('rejects an anonymous %s %s', async (method, path) => {
    const response = await request(createTestApp())[method](path);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it.each(paths)('rejects a signed-in non-publisher %s %s', async (method, path) => {
    const response = await request(createTestApp())
      [method](path)
      .set('Cookie', await publisherCookie(['internal']));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });
});

describe('GET /api/internal/topics', () => {
  it('lists topics with their ids, as ISO timestamps', async () => {
    const response = await request(createTestApp({ list: async () => [topic] }))
      .get('/api/internal/topics')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: topic.id,
        slug: 'topic-a',
        title: 'Topic A',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });
});

describe('POST /api/internal/topics', () => {
  async function post(app: Express, body: unknown) {
    return request(app)
      .post('/api/internal/topics')
      .set('Cookie', await publisherCookie())
      .send(body as object);
  }

  it('creates the topic and returns it with the id the database minted', async () => {
    const app = createTestApp({ create: async () => ({ ok: true, topic }) });

    const response = await post(app, validSubmission);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      topic: {
        id: topic.id,
        slug: 'topic-a',
        title: 'Topic A',
        description: 'All about topic A.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    });
  });

  it('trims the submitted values before creating', async () => {
    let written: unknown;
    const app = createTestApp({
      create: async (values) => {
        written = values;
        return { ok: true, topic };
      },
    });

    await post(app, { title: '  Topic A  ', slug: ' topic-a ', description: ' A description. ' });

    expect(written).toEqual({ title: 'Topic A', slug: 'topic-a', description: 'A description.' });
  });

  it('rejects an invalid submission with a field message', async () => {
    const response = await post(createTestApp(), { ...validSubmission, title: '   ' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'validation_failed',
      fieldErrors: { title: 'Enter a topic name' },
    });
  });

  it('returns a 409 with a slug field message when the slug is taken', async () => {
    const app = createTestApp({ create: async () => ({ ok: false, reason: 'slug_taken' }) });

    const response = await post(app, validSubmission);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'slug_taken',
      fieldErrors: { slug: 'This slug is already used' },
    });
  });

  it('does not reach the repository when the submission is invalid', async () => {
    // Nothing is stubbed, so any repository call throws and the response would be a 500.
    const response = await post(createTestApp(), { title: '', slug: '', description: '' });

    expect(response.status).toBe(400);
  });
});

describe('GET /api/internal/topics/:id', () => {
  it('returns the topic with its description', async () => {
    const response = await request(createTestApp({ findById: async () => topic }))
      .get(`/api/internal/topics/${topic.id}`)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: topic.id, description: 'All about topic A.' });
  });

  it('returns the standard not-found body for an unknown id', async () => {
    const response = await request(createTestApp({ findById: async () => undefined }))
      .get('/api/internal/topics/00000000-0000-7000-8000-0000000000ff')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('refuses a malformed id rather than handing it to the database', async () => {
    const response = await request(createTestApp())
      .get('/api/internal/topics/not-a-uuid')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_id' });
  });
});

describe('PUT /api/internal/topics/:id', () => {
  async function put(app: Express, body: unknown, id: string = topic.id) {
    return request(app)
      .put(`/api/internal/topics/${id}`)
      .set('Cookie', await publisherCookie())
      .send(body as object);
  }

  it('reports a write that changed the topic', async () => {
    const app = createTestApp({
      update: async () => ({ ok: true, topic, changed: true }),
    });

    const response = await put(app, validSubmission);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      changed: true,
      topic: {
        id: topic.id,
        slug: 'topic-a',
        title: 'Topic A',
        description: 'All about topic A.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    });
  });

  it('reports a submission that changed nothing', async () => {
    const app = createTestApp({ update: async () => ({ ok: true, topic, changed: false }) });

    const response = await put(app, validSubmission);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ changed: false });
  });

  it('trims the submitted values before writing them', async () => {
    let written: unknown;
    const app = createTestApp({
      update: async (_id, values) => {
        written = values;
        return { ok: true, topic, changed: true };
      },
    });

    await put(app, { title: '  Topic A  ', slug: ' topic-a ', description: ' A description. ' });

    expect(written).toEqual({
      title: 'Topic A',
      slug: 'topic-a',
      description: 'A description.',
    });
  });

  it.each([
    ['title', { ...validSubmission, title: '   ' }, { title: 'Enter a topic name' }],
    [
      'description',
      { ...validSubmission, description: '' },
      { description: 'Enter a description' },
    ],
    ['missing slug', { ...validSubmission, slug: '' }, { slug: 'Enter a slug' }],
    [
      'malformed slug',
      { ...validSubmission, slug: 'Not A Slug' },
      { slug: 'Slug must be lowercase letters or numbers, separated by hyphens' },
    ],
  ])('rejects an invalid %s with a field message', async (_case, body, fieldErrors) => {
    const response = await put(createTestApp(), body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'validation_failed', fieldErrors });
  });

  it('refuses a malformed id', async () => {
    const response = await put(createTestApp(), validSubmission, 'not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_id' });
  });

  it('returns a 404 when the topic has gone', async () => {
    const app = createTestApp({ update: async () => ({ ok: false, reason: 'not_found' }) });

    const response = await put(app, validSubmission);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('returns a 409 with a slug field message when the slug is taken', async () => {
    const app = createTestApp({ update: async () => ({ ok: false, reason: 'slug_taken' }) });

    const response = await put(app, validSubmission);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'slug_taken',
      fieldErrors: { slug: 'This slug is already used' },
    });
  });

  it('does not reach the repository when the submission is invalid', async () => {
    // Nothing is stubbed, so any repository call throws and the response would be a 500.
    const response = await put(createTestApp(), { title: '', slug: '', description: '' });

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/internal/topics/:id', () => {
  async function del(app: Express, id: string = topic.id) {
    return request(app)
      .delete(`/api/internal/topics/${id}`)
      .set('Cookie', await publisherCookie());
  }

  it('deletes the topic and answers with an empty 204', async () => {
    const app = createTestApp({ delete: async () => ({ ok: true }) });

    const response = await del(app);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it('passes the id through to the repository', async () => {
    let asked: string | undefined;
    const app = createTestApp({
      delete: async (id) => {
        asked = id;
        return { ok: true };
      },
    });

    await del(app);

    expect(asked).toBe(topic.id);
  });

  it('refuses a malformed id rather than handing it to the database', async () => {
    const response = await del(createTestApp(), 'not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_id' });
  });

  it('returns a 404 when the topic has already gone', async () => {
    const app = createTestApp({ delete: async () => ({ ok: false, reason: 'not_found' }) });

    const response = await del(app);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });
});
