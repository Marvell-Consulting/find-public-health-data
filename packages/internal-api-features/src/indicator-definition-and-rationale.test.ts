import { createApiApp } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { indicatorDefinitionAndRationaleRouter } from './indicator-definition-and-rationale.ts';
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
const path = `/api/internal/indicators/${id}/definition-and-rationale`;

function draftState(draft: { definition: string | null; rationale: string | null }) {
  return { id, shortId: 90366, draft, indicatorStatus: 'new', draftStatus: 'draft' };
}

// What every section shares is tested in indicator-section.test.ts.
function createTestApp(overrides: FakeInternalRepositoryOverrides['indicators'] = {}): Express {
  const repositories = createFakeInternalRepositories({ indicators: overrides });
  const app = createApiApp({ logger: pino({ level: 'silent' }), serviceName: 'internal-api' });

  app.use(indicatorDefinitionAndRationaleRouter(repositories.indicators, verifier));

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

describe('GET /api/internal/indicators/:id/definition-and-rationale', () => {
  it('serves an unanswered question as null', async () => {
    const findDraftState = vi
      .fn()
      .mockResolvedValue(draftState({ definition: 'A definition', rationale: null }));

    const response = await request(createTestApp({ findDraftState }))
      .get(path)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ definition: 'A definition', rationale: null });
  });
});

describe('PUT /api/internal/indicators/:id/definition-and-rationale', () => {
  it('writes both answers to their columns without their surrounding spaces', async () => {
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });
    const stored = { definition: 'A definition', rationale: 'A rationale' };

    const response = await request(
      createTestApp({ updateDraft, findDraftState: vi.fn().mockResolvedValue(draftState(stored)) }),
    )
      .put(path)
      .set('Cookie', await publisherCookie())
      .send({ definition: '  A definition\n', rationale: '\tA rationale  ' });

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith(id, stored, {}, 'test-user');
    expect(response.body).toEqual(stored);
  });

  it.each([
    [
      { definition: '', rationale: '' },
      {
        definition: 'Enter the definition of the indicator',
        rationale: 'Enter the rationale for the indicator',
      },
    ],
    [
      { definition: '   ', rationale: 'A rationale' },
      { definition: 'Enter the definition of the indicator' },
    ],
    [
      { definition: 'A definition', rationale: '\n\t' },
      { rationale: 'Enter the rationale for the indicator' },
    ],
  ])('refuses %o without writing anything', async (body, fieldErrors) => {
    const updateDraft = vi.fn();

    const response = await request(createTestApp({ updateDraft }))
      .put(path)
      .set('Cookie', await publisherCookie())
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'validation_failed', fieldErrors });
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it.each([{}, { definition: 'A definition' }, { definition: 1, rationale: 2 }])(
    'refuses %o, which the form never sends, without writing anything',
    async (body) => {
      const updateDraft = vi.fn();

      const response = await request(createTestApp({ updateDraft }))
        .put(path)
        .set('Cookie', await publisherCookie())
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_failed');
      expect(updateDraft).not.toHaveBeenCalled();
    },
  );

  it('accepts long answers, setting no length limit of its own', async () => {
    const long = 'a'.repeat(20_000);
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });

    const response = await request(
      createTestApp({
        updateDraft,
        findDraftState: vi
          .fn()
          .mockResolvedValue(draftState({ definition: long, rationale: long })),
      }),
    )
      .put(path)
      .set('Cookie', await publisherCookie())
      .send({ definition: long, rationale: long });

    expect(response.status).toBe(200);
  });
});
