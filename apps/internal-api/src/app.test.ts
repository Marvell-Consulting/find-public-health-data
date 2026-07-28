import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
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

const session = createJwtSessionService({
  audience: 'fphd-internal',
  clock: () => new Date('2026-07-23T10:00:00.000Z'),
  cookieName: 'fphd-internal-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});
const verifier = createJwtSessionVerifier(session);
const app = createApp({ session: verifier, topics: fakeTopics([]) });

async function createCookie(roles: readonly string[]): Promise<string> {
  const token = await session.issueToken({
    expiresInSeconds: 900,
    roles,
    subject: 'test-user',
  });
  return session.createCookieHeader(token, 900);
}

describe('internal API', () => {
  it('keeps the public surface open', async () => {
    const response = await request(app).get('/api');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ audience: 'public' });
  });

  it('requires authentication for its internal surface', async () => {
    const response = await request(app).get('/api/internal');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it('rejects a signed-in user without the internal role', async () => {
    const response = await request(app)
      .get('/api/internal')
      .set('Cookie', await createCookie(['public']));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });

  it('allows an internal user', async () => {
    const response = await request(app)
      .get('/api/internal')
      .set('Cookie', await createCookie(['public', 'internal']));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ audience: 'internal' });
  });

  it('rejects and clears an invalid session', async () => {
    const response = await request(app)
      .get('/api/internal')
      .set('Cookie', 'fphd-internal-session=not-a-jwt');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'invalid_session' });
    expect(response.get('Set-Cookie')?.[0]).toContain('Max-Age=0');
  });

  it('lists topics in the order the repository returns them, as ISO timestamps', async () => {
    const response = await request(
      createApp({ session: verifier, topics: fakeTopics([topicA, topicB]) }),
    ).get('/api/topics');

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

    const response = await request(createApp({ session: verifier, topics: failing })).get(
      '/api/topics',
    );

    expect(response.status).toBe(500);
  });
});
