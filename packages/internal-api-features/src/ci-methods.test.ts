import { createApiApp } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { internalCiMethodsRouter } from './ci-methods.ts';
import { ciMethodListSchema } from './contract.ts';
import { createFakeInternalRepositories, type FakeInternalRepositoryOverrides } from './testing.ts';

const session = createJwtSessionService({
  audience: 'fphd-internal',
  clock: () => new Date('2026-08-04T10:00:00.000Z'),
  cookieName: 'fphd-internal-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});
const verifier = createJwtSessionVerifier(session);

const path = '/api/internal/ci-methods';

const methods = [
  {
    id: '019fa38f-073f-764e-9ac6-1c4d03b1cb92',
    name: "Byar's method",
    description: 'A standard description.',
    kind: 'standard',
  },
  {
    id: '019fa38f-0746-7e1c-8826-0ee5d2b83fef',
    name: 'Other method',
    description: null,
    kind: 'other',
  },
] as const;

function createTestApp(overrides: FakeInternalRepositoryOverrides['ciMethods'] = {}): Express {
  const repositories = createFakeInternalRepositories({ ciMethods: overrides });
  const app = createApiApp({ logger: pino({ level: 'silent' }), serviceName: 'internal-api' });

  app.use(internalCiMethodsRouter(repositories.ciMethods, verifier));

  return app;
}

async function cookie(roles: readonly string[]) {
  const token = await session.issueToken({ expiresInSeconds: 900, roles, subject: 'test-user' });
  return session.createCookieHeader(token, 900);
}

describe('GET /api/internal/ci-methods', () => {
  it('lists every method in the order the repository gives, in the shape the contract describes', async () => {
    const response = await request(createTestApp({ list: vi.fn().mockResolvedValue(methods) }))
      .get(path)
      .set('Cookie', await cookie(['internal', 'publisher']));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(methods);
    expect(ciMethodListSchema.safeParse(response.body).success).toBe(true);
  });

  it('rejects an anonymous request', async () => {
    const response = await request(createTestApp()).get(path);

    expect(response.status).toBe(401);
  });

  it('rejects a signed-in non-publisher', async () => {
    const response = await request(createTestApp())
      .get(path)
      .set('Cookie', await cookie(['internal']));

    expect(response.status).toBe(403);
  });
});
