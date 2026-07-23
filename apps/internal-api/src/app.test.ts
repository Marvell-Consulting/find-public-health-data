import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

const session = createJwtSessionService({
  audience: 'fphd-internal',
  clock: () => new Date('2026-07-23T10:00:00.000Z'),
  cookieName: 'fphd-internal-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});
const app = createApp(createJwtSessionVerifier(session));

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
});
