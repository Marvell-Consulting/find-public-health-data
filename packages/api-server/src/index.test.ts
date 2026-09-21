import { Writable } from 'node:stream';

import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import { createLogger } from '@fphd/logger';
import express, { type Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { addNotFoundHandler, createApiApp, requireApiSession, requireJwtRole } from './index.ts';

const logger = createLogger({ name: 'test-api', level: 'silent' });

describe('API server', () => {
  // The probes themselves are `@fphd/express`'s; this only asserts an API app is built on it,
  // and passes its own name through.
  it('serves the shared probes under its own service name', async () => {
    const app = createApiApp({ logger, serviceName: 'test-api' });

    const live = await request(app).get('/livez');
    const ready = await request(app).get('/readyz');

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(live.body).toEqual({ status: 'ok', service: 'test-api' });
  });

  it('sends the security headers that apply to a JSON response too', async () => {
    const app = createApiApp({ logger, serviceName: 'test-api' });

    const response = await request(app).get('/api');

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves only the shared public route table', async () => {
    const app = createApiApp({ logger, serviceName: 'test-api' });
    addNotFoundHandler(app);

    const publicResponse = await request(app).get('/api');
    const internalResponse = await request(app).get('/api/internal');

    expect(publicResponse.status).toBe(200);
    expect(internalResponse.status).toBe(404);
  });

  // The line's shape is `@fphd/express`'s; this asserts an API app writes one at all, under its
  // own name, which is what FPH-316's verification found missing.
  it('logs each request through the logger it was given', async () => {
    const lines: Record<string, unknown>[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(JSON.parse(String(chunk)));
        callback();
      },
    });
    const app = createApiApp({
      logger: pino({ name: 'test-api' }, destination),
      serviceName: 'test-api',
    });
    addNotFoundHandler(app);

    await request(app).get('/api');
    await request(app).get('/api/nowhere');
    await request(app).get('/livez');
    await new Promise((resolve) => setImmediate(resolve));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ name: 'test-api', req: { method: 'GET', url: '/api' } });
    expect(lines[1]).toMatchObject({ res: { statusCode: 404 } });
  });

  it('logs a call under the id the web app forwarded', async () => {
    const lines: Record<string, unknown>[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(JSON.parse(String(chunk)));
        callback();
      },
    });
    const app = createApiApp({
      logger: pino({ name: 'test-api' }, destination),
      serviceName: 'test-api',
    });

    await request(app).get('/api').set('X-Fphd-Request-Id', '019924a1-2c40-7000-8000-000000000001');
    await new Promise((resolve) => setImmediate(resolve));

    expect(lines[0]).toMatchObject({ req: { id: '019924a1-2c40-7000-8000-000000000001' } });
  });
});

const session = createJwtSessionService({
  audience: 'fphd-internal',
  clock: () => new Date('2026-08-04T10:00:00.000Z'),
  cookieName: 'fphd-internal-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});
const verifier = createJwtSessionVerifier(session);

function createGuardedApp(): Express {
  const app = express();

  app.get('/guarded', requireJwtRole(verifier, 'publisher'), (_request, response) => {
    response.status(200).json(requireApiSession(response));
  });
  app.get('/unguarded', (_request, response) => {
    response.status(200).json(requireApiSession(response));
  });

  return app;
}

async function cookieFor(subject: string, roles: readonly string[]) {
  const token = await session.issueToken({ expiresInSeconds: 900, roles, subject });
  return session.createCookieHeader(token, 900);
}

describe('requireJwtRole', () => {
  it('refuses a request carrying no session', async () => {
    const response = await request(createGuardedApp()).get('/guarded');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it('clears the cookie of a session it cannot verify', async () => {
    const response = await request(createGuardedApp())
      .get('/guarded')
      .set('Cookie', 'fphd-internal-session=not-a-jwt');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'invalid_session' });
    expect(response.get('Set-Cookie')?.[0]).toContain('Max-Age=0');
  });

  it('refuses a session without the role', async () => {
    const response = await request(createGuardedApp())
      .get('/guarded')
      .set('Cookie', await cookieFor('someone', ['internal']));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });

  it('hands the verified subject and roles to the handler behind it', async () => {
    const response = await request(createGuardedApp())
      .get('/guarded')
      .set('Cookie', await cookieFor('publisher-1', ['internal', 'publisher']));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ roles: ['internal', 'publisher'], sub: 'publisher-1' });
  });
});

describe('requireApiSession', () => {
  it('fails loudly in a handler no role guard runs before', async () => {
    const response = await request(createGuardedApp()).get('/unguarded');

    expect(response.status).toBe(500);
  });
});
