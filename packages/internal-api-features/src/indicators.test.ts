import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { IndicatorAdminDetailRow, IndicatorAdminRow } from './indicator-repository.ts';
import { INDICATORS_PAGE_SIZE, internalIndicatorsRouter } from './indicators.ts';
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

const row: IndicatorAdminRow = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Life expectancy at birth',
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const detailRow: IndicatorAdminDetailRow = {
  ...row,
  shortId: 90366,
  publishedSlug: 'life-expectancy-at-birth',
  status: 'published',
};

// The router alone, on a bare Express app: these tests cover its status mapping, not what
// `createApiApp` wraps around it.
function createTestApp(overrides: FakeInternalRepositoryOverrides['indicators'] = {}): Express {
  const repositories = createFakeInternalRepositories({ indicators: overrides });
  const app = express();

  app.use(express.json());
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

describe('GET /api/internal/indicators/:id', () => {
  it('rejects an anonymous request', async () => {
    const response = await request(createTestApp()).get(`/api/internal/indicators/${row.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it('rejects a signed-in non-publisher', async () => {
    const response = await request(createTestApp())
      .get(`/api/internal/indicators/${row.id}`)
      .set('Cookie', await publisherCookie(['internal']));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });

  it('serves the indicator with its public identifiers and stored status', async () => {
    const findById = vi.fn().mockResolvedValue(detailRow);

    const response = await request(createTestApp({ findById }))
      .get(`/api/internal/indicators/${row.id}`)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(findById).toHaveBeenCalledWith(row.id);
    expect(response.body).toEqual({
      id: row.id,
      shortId: 90366,
      name: 'Life expectancy at birth',
      publishedSlug: 'life-expectancy-at-birth',
      status: 'published',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('answers 404 for an indicator that does not exist', async () => {
    const findById = vi.fn().mockResolvedValue(undefined);

    const response = await request(createTestApp({ findById }))
      .get('/api/internal/indicators/00000000-0000-7000-8000-000000000000')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('rejects an id that is not a UUID without asking the repository', async () => {
    const findById = vi.fn();

    const response = await request(createTestApp({ findById }))
      .get('/api/internal/indicators/108')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_id' });
    expect(findById).not.toHaveBeenCalled();
  });
});

describe('POST /api/internal/indicators', () => {
  const created = { ok: true, indicatorId: row.id, shortId: 90366, versionId: 'version-1' };
  const draftRow: IndicatorAdminDetailRow = {
    ...row,
    shortId: 90366,
    publishedSlug: null,
    status: 'draft',
  };

  it('rejects an anonymous request', async () => {
    const response = await request(createTestApp())
      .post('/api/internal/indicators')
      .send({ name: 'A new indicator' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it('rejects a signed-in non-publisher', async () => {
    const response = await request(createTestApp())
      .post('/api/internal/indicators')
      .set('Cookie', await publisherCookie(['internal']))
      .send({ name: 'A new indicator' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });

  it('creates a draft for the signed-in publisher and serves it back', async () => {
    const createDraft = vi.fn().mockResolvedValue(created);
    const findById = vi.fn().mockResolvedValue(draftRow);

    const response = await request(createTestApp({ createDraft, findById }))
      .post('/api/internal/indicators')
      .set('Cookie', await publisherCookie())
      .send({ name: 'Life expectancy at birth' });

    expect(response.status).toBe(201);
    expect(createDraft).toHaveBeenCalledWith({ name: 'Life expectancy at birth' }, 'test-user');
    expect(response.body).toEqual({
      id: row.id,
      shortId: 90366,
      name: 'Life expectancy at birth',
      publishedSlug: null,
      status: 'draft',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('stores the name without its surrounding spaces', async () => {
    const createDraft = vi.fn().mockResolvedValue(created);

    await request(createTestApp({ createDraft, findById: async () => draftRow }))
      .post('/api/internal/indicators')
      .set('Cookie', await publisherCookie())
      .send({ name: '  Life expectancy at birth  ' });

    expect(createDraft).toHaveBeenCalledWith({ name: 'Life expectancy at birth' }, 'test-user');
  });

  it.each([{}, { name: '' }, { name: '   ' }, { name: 108 }])(
    'rejects %s without creating anything',
    async (body) => {
      const createDraft = vi.fn();

      const response = await request(createTestApp({ createDraft }))
        .post('/api/internal/indicators')
        .set('Cookie', await publisherCookie())
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_failed');
      expect(createDraft).not.toHaveBeenCalled();
    },
  );

  it('reports a name another indicator already holds against the field', async () => {
    const createDraft = vi.fn().mockResolvedValue({ ok: false, reason: 'slug_taken' });
    const findById = vi.fn();

    const response = await request(createTestApp({ createDraft, findById }))
      .post('/api/internal/indicators')
      .set('Cookie', await publisherCookie())
      .send({ name: 'Life expectancy at birth' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'slug_taken',
      fieldErrors: { name: 'An indicator with this name already exists' },
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('names the field a rejected submission failed on', async () => {
    const response = await request(createTestApp({ createDraft: vi.fn() }))
      .post('/api/internal/indicators')
      .set('Cookie', await publisherCookie())
      .send({ name: '' });

    expect(response.body).toEqual({
      error: 'validation_failed',
      fieldErrors: { name: 'Enter the name of the indicator' },
    });
  });
});

describe('PATCH /api/internal/indicators/:id', () => {
  const draftRow: IndicatorAdminDetailRow = {
    ...row,
    shortId: 90366,
    publishedSlug: null,
    status: 'draft',
  };
  const path = `/api/internal/indicators/${row.id}`;

  it('rejects an anonymous request', async () => {
    const response = await request(createTestApp()).patch(path).send({ name: 'A better name' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it('rejects a signed-in non-publisher', async () => {
    const response = await request(createTestApp())
      .patch(path)
      .set('Cookie', await publisherCookie(['internal']))
      .send({ name: 'A better name' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });

  it('renames the draft as the signed-in publisher and serves the indicator back', async () => {
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });
    const findById = vi.fn().mockResolvedValue({ ...draftRow, name: 'A better name' });

    const response = await request(createTestApp({ updateDraft, findById }))
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: '  A better name  ' });

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith(row.id, { name: 'A better name' }, {}, 'test-user');
    expect(response.body).toEqual({
      id: row.id,
      shortId: 90366,
      name: 'A better name',
      publishedSlug: null,
      status: 'draft',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('names no memberships, so the draft keeps its topics and classifications', async () => {
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });

    await request(createTestApp({ updateDraft, findById: async () => draftRow }))
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: 'A better name' });

    expect(updateDraft.mock.calls[0]?.[2]).toEqual({});
  });

  it('rejects an id that is not a UUID without touching the repository', async () => {
    const updateDraft = vi.fn();

    const response = await request(createTestApp({ updateDraft }))
      .patch('/api/internal/indicators/108')
      .set('Cookie', await publisherCookie())
      .send({ name: 'A better name' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_id' });
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('asks for a name when the submission has none', async () => {
    const updateDraft = vi.fn();

    const response = await request(createTestApp({ updateDraft }))
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: '  ' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'validation_failed',
      fieldErrors: { name: 'Enter the name of the indicator' },
    });
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('answers 404 for an indicator that does not exist', async () => {
    const response = await request(
      createTestApp({
        updateDraft: async () => ({ ok: false, reason: 'no_draft' }),
        findById: async () => undefined,
      }),
    )
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: 'A better name' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('reports a name another indicator already holds against the field', async () => {
    const response = await request(
      createTestApp({
        updateDraft: async () => ({ ok: false, reason: 'slug_taken' }),
        findById: async () => draftRow,
      }),
    )
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: 'Life expectancy at birth' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'slug_taken',
      fieldErrors: { name: 'An indicator with this name already exists' },
    });
  });

  it('answers 409 for an indicator with no draft to rename', async () => {
    const response = await request(
      createTestApp({
        updateDraft: async () => ({ ok: false, reason: 'no_draft' }),
        findById: async () => detailRow,
      }),
    )
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: 'A better name' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'no_draft' });
  });
});
