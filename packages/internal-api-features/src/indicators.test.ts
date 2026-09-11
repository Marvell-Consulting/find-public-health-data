import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { IndicatorAdminRow } from './indicator-repository.js';
import { INDICATORS_PAGE_SIZE, internalIndicatorsRouter } from './indicators.js';
import { createFakeInternalRepositories, type FakeInternalRepositoryOverrides } from './testing.js';

const session = createJwtSessionService({
  audience: 'fphd-internal',
  clock: () => new Date('2026-08-04T10:00:00.000Z'),
  cookieName: 'fphd-internal-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});
const verifier = createJwtSessionVerifier(session);

const row: IndicatorAdminRow = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Life expectancy at birth',
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

// The router alone, on a bare Express app: these tests cover its status mapping, not what
// `createApiApp` wraps around it.
function createTestApp(overrides: FakeInternalRepositoryOverrides['indicators'] = {}): Express {
  const repositories = createFakeInternalRepositories({ indicators: overrides });
  const app = express();

  app.use(internalIndicatorsRouter(repositories.indicators, verifier));

  return app;
}

async function publisherCookie(roles: readonly string[] = ['internal', 'publisher']) {
  const token = await session.issueToken({ expiresInSeconds: 900, roles, subject: 'test-user' });
  return session.createCookieHeader(token, 900);
}

describe('GET /api/internal/indicators', () => {
  it('rejects an anonymous request', async () => {
    const response = await request(createTestApp()).get('/api/internal/indicators');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it('rejects a signed-in non-publisher', async () => {
    const response = await request(createTestApp())
      .get('/api/internal/indicators')
      .set('Cookie', await publisherCookie(['internal']));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });

  it('serves the first page by default, with ISO timestamps and the page size used', async () => {
    const listPage = vi.fn().mockResolvedValue({ indicators: [row], total: 23 });

    const response = await request(createTestApp({ listPage }))
      .get('/api/internal/indicators')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(listPage).toHaveBeenCalledWith(1, INDICATORS_PAGE_SIZE);
    expect(response.body).toEqual({
      indicators: [
        {
          id: row.id,
          name: 'Life expectancy at birth',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: INDICATORS_PAGE_SIZE,
      total: 23,
    });
  });

  it('serves the page asked for', async () => {
    const listPage = vi.fn().mockResolvedValue({ indicators: [], total: 23 });

    const response = await request(createTestApp({ listPage }))
      .get('/api/internal/indicators?page=3')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(listPage).toHaveBeenCalledWith(3, INDICATORS_PAGE_SIZE);
    expect(response.body).toMatchObject({ indicators: [], page: 3, total: 23 });
  });

  it.each(['0', '-1', '1.5', 'two', '1&page=2'])(
    'rejects a page of %s as a bad request',
    async (page) => {
      const response = await request(createTestApp())
        .get(`/api/internal/indicators?page=${page}`)
        .set('Cookie', await publisherCookie());

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'invalid_page' });
    },
  );
});
