import { createApiApp } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { indicatorCalculationRouter } from './indicator-calculation.ts';
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
const path = `/api/internal/indicators/${id}/calculation`;

interface CalculationColumns {
  methodology: string | null;
  calculatedBy: 'ohid' | 'dhsc' | 'other' | null;
  calculatedByOther: string | null;
}

function draftState(draft: CalculationColumns) {
  return { id, shortId: 90366, draft, indicatorStatus: 'new', draftStatus: 'draft' };
}

// What every section shares is tested in indicator-section.test.ts.
function createTestApp(overrides: FakeInternalRepositoryOverrides['indicators'] = {}): Express {
  const repositories = createFakeInternalRepositories({ indicators: overrides });
  const app = createApiApp({ logger: pino({ level: 'silent' }), serviceName: 'internal-api' });

  app.use(indicatorCalculationRouter(repositories.indicators, verifier));

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

async function put(body: object, stored: CalculationColumns) {
  const updateDraft = vi.fn().mockResolvedValue({ ok: true });
  const response = await request(
    createTestApp({ updateDraft, findDraftState: vi.fn().mockResolvedValue(draftState(stored)) }),
  )
    .put(path)
    .set('Cookie', await publisherCookie())
    .send(body);

  return { response, updateDraft };
}

describe('GET /api/internal/indicators/:id/calculation', () => {
  it('serves each unanswered question as null', async () => {
    const findDraftState = vi
      .fn()
      .mockResolvedValue(
        draftState({ methodology: null, calculatedBy: null, calculatedByOther: null }),
      );

    const response = await request(createTestApp({ findDraftState }))
      .get(path)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      methodology: null,
      calculatedBy: null,
      calculatedByOther: null,
    });
  });

  it('serves who calculated the indicator as the value the form chooses', async () => {
    const stored = { methodology: 'A method', calculatedBy: 'other', calculatedByOther: 'ONS' };
    const findDraftState = vi.fn().mockResolvedValue(draftState(stored as CalculationColumns));

    const response = await request(createTestApp({ findDraftState }))
      .get(path)
      .set('Cookie', await publisherCookie());

    expect(response.body).toEqual(stored);
  });
});

describe('PUT /api/internal/indicators/:id/calculation', () => {
  it('writes the methodology and the other organisations without their surrounding spaces', async () => {
    const stored = { methodology: 'A method', calculatedBy: 'other', calculatedByOther: 'ONS' };

    const { response, updateDraft } = await put(
      { methodology: '  A method\n', calculatedBy: 'other', calculatedByOther: '\tONS ' },
      stored as CalculationColumns,
    );

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith(id, stored, {}, 'test-user');
    expect(response.body).toEqual(stored);
  });

  it.each(['ohid', 'dhsc'] as const)(
    'clears the other organisations when %s calculated the indicator',
    async (calculatedBy) => {
      const stored = { methodology: 'A method', calculatedBy, calculatedByOther: null };

      const { response, updateDraft } = await put(
        { methodology: 'A method', calculatedBy, calculatedByOther: 'Left from before' },
        stored,
      );

      expect(response.status).toBe(200);
      expect(updateDraft).toHaveBeenCalledWith(id, stored, {}, 'test-user');
      expect(response.body).toEqual(stored);
    },
  );

  it.each([
    [
      { methodology: '', calculatedBy: '', calculatedByOther: '' },
      {
        methodology: 'Enter the methodology',
        calculatedBy: 'Select who calculated the indicator',
      },
    ],
    [
      { methodology: ' ', calculatedBy: 'ohid', calculatedByOther: '' },
      { methodology: 'Enter the methodology' },
    ],
    [
      { methodology: 'A method', calculatedBy: '', calculatedByOther: 'ONS' },
      { calculatedBy: 'Select who calculated the indicator' },
    ],
    [
      { methodology: 'A method', calculatedBy: 'other', calculatedByOther: ' \n' },
      { calculatedByOther: 'Enter details of the other organisation or organisations' },
    ],
    [
      { methodology: '', calculatedBy: 'other', calculatedByOther: '' },
      {
        methodology: 'Enter the methodology',
        calculatedByOther: 'Enter details of the other organisation or organisations',
      },
    ],
    [
      { methodology: 'A method', calculatedBy: 'nhs', calculatedByOther: '' },
      { calculatedBy: 'Select who calculated the indicator' },
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

  it.each([
    {},
    { methodology: 'A method', calculatedBy: 'ohid' },
    { methodology: 1, calculatedBy: 'ohid', calculatedByOther: '' },
  ])('refuses %o, which the form never sends, without writing anything', async (body) => {
    const updateDraft = vi.fn();

    const response = await request(createTestApp({ updateDraft }))
      .put(path)
      .set('Cookie', await publisherCookie())
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_failed');
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('accepts long answers, setting no length limit of its own', async () => {
    const long = 'a'.repeat(20_000);
    const stored = { methodology: long, calculatedBy: 'other', calculatedByOther: long } as const;

    const { response } = await put(stored, stored);

    expect(response.status).toBe(200);
  });
});
