import { createApiApp } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import { POLARITIES } from '@fphd/utils/polarity';
import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { indicatorPolarityRouter } from './indicator-polarity.ts';
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

const id = '00000000-0000-7000-8000-000000000001';
const path = `/api/internal/indicators/${id}/polarity`;

function draftState(polarity: string | null) {
  return { id, shortId: 90366, draft: { polarity }, indicatorStatus: 'new', draftStatus: 'draft' };
}

// What every section shares is tested in indicator-section.test.ts.
function createTestApp(overrides: FakeInternalRepositoryOverrides['indicators'] = {}): Express {
  const repositories = createFakeInternalRepositories({ indicators: overrides });
  const app = createApiApp({ logger: pino({ level: 'silent' }), serviceName: 'internal-api' });

  app.use(indicatorPolarityRouter(repositories.indicators, verifier));

  return app;
}

async function publisherCookie() {
  const token = await session.issueToken({
    expiresInSeconds: 900,
    roles: ['internal', 'publisher'],
    subject: 'test-user',
  });
  return session.createCookieHeader(token, 900);
}

describe('GET /api/internal/indicators/:id/polarity', () => {
  it('serves an unanswered question as null', async () => {
    const response = await request(
      createTestApp({ findDraftState: vi.fn().mockResolvedValue(draftState(null)) }),
    )
      .get(path)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ polarity: null });
  });

  it('serves the stored polarity', async () => {
    const response = await request(
      createTestApp({ findDraftState: vi.fn().mockResolvedValue(draftState('no-polarity')) }),
    )
      .get(path)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ polarity: 'no-polarity' });
  });
});

describe('PUT /api/internal/indicators/:id/polarity', () => {
  it.each(POLARITIES)('stores %s', async (polarity) => {
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });

    const response = await request(
      createTestApp({
        updateDraft,
        findDraftState: vi.fn().mockResolvedValue(draftState(polarity)),
      }),
    )
      .put(path)
      .set('Cookie', await publisherCookie())
      .send({ polarity });

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith(id, { polarity }, {}, 'test-user');
    expect(response.body).toEqual({ polarity });
  });

  it('asks for a polarity when none is chosen, without writing anything', async () => {
    const updateDraft = vi.fn();

    const response = await request(createTestApp({ updateDraft }))
      .put(path)
      .set('Cookie', await publisherCookie())
      .send({ polarity: '' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'validation_failed',
      fieldErrors: { polarity: 'Select the polarity of the indicator' },
    });
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it.each([{}, { polarity: 'sideways' }, { polarity: 'RAG - High is good' }, { polarity: 1 }])(
    'refuses %o, which the form never sends, without writing anything',
    async (body) => {
      const updateDraft = vi.fn();

      const response = await request(createTestApp({ updateDraft }))
        .put(path)
        .set('Cookie', await publisherCookie())
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.fieldErrors).toEqual({
        polarity: 'Select the polarity of the indicator',
      });
      expect(updateDraft).not.toHaveBeenCalled();
    },
  );
});
