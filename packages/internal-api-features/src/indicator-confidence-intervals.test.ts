import { createApiApp } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { CiMethodRow } from './ci-method-repository.ts';
import { indicatorConfidenceIntervalsRouter } from './indicator-confidence-intervals.ts';
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
const path = `/api/internal/indicators/${id}/confidence-intervals`;

const METHODS: Record<CiMethodRow['kind'], CiMethodRow> = {
  standard: {
    id: '019fa38f-073f-764e-9ac6-1c4d03b1cb92',
    name: "Byar's method",
    description: 'A standard description.',
    kind: 'standard',
  },
  other: {
    id: '019fa38f-0746-7e1c-8826-0ee5d2b83fef',
    name: 'Other method',
    description: null,
    kind: 'other',
  },
  none: {
    id: '019fa38f-0747-73bb-b8a4-bb6e8f3c244e',
    name: 'Unknown',
    description: null,
    kind: 'none',
  },
};

const unanswered = {
  ciMethodId: null,
  ciMethodModified: null,
  ciMethodModifications: null,
  ciMethodOtherDetail: null,
};

// Every follow-up filled in, as a form without JavaScript may send them.
const everyAnswer = {
  ciMethodModified: 'yes',
  ciMethodModifications: '  Adjusted for clustering  ',
  ciMethodOtherDetail: '  Bootstrap intervals\n',
};

function draftState(draft: Partial<Record<keyof typeof unanswered, unknown>> = {}) {
  return {
    id,
    shortId: 90366,
    draft: { ...unanswered, ...draft },
    indicatorStatus: 'new',
    draftStatus: 'draft',
  };
}

function findMethod(methodId: string) {
  return Promise.resolve(Object.values(METHODS).find((method) => method.id === methodId));
}

// What every section shares is tested in indicator-section.test.ts.
function createTestApp(overrides: FakeInternalRepositoryOverrides = {}): Express {
  const repositories = createFakeInternalRepositories({
    ciMethods: { findById: vi.fn(findMethod) },
    ...overrides,
  });
  const app = createApiApp({ logger: pino({ level: 'silent' }), serviceName: 'internal-api' });

  app.use(
    indicatorConfidenceIntervalsRouter(repositories.indicators, repositories.ciMethods, verifier),
  );

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

async function put(body: object, updateDraft = vi.fn().mockResolvedValue({ ok: true })) {
  const response = await request(
    createTestApp({
      indicators: { updateDraft, findDraftState: vi.fn().mockResolvedValue(draftState()) },
    }),
  )
    .put(path)
    .set('Cookie', await publisherCookie())
    .send(body);

  return { response, updateDraft };
}

describe('GET /api/internal/indicators/:id/confidence-intervals', () => {
  it("serves the draft's answers as the form's text", async () => {
    const findDraftState = vi.fn().mockResolvedValue(
      draftState({
        ciMethodId: METHODS.standard.id,
        ciMethodModified: true,
        ciMethodModifications: 'Adjusted for clustering',
      }),
    );

    const response = await request(createTestApp({ indicators: { findDraftState } }))
      .get(path)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ciMethodId: METHODS.standard.id,
      ciMethodModified: 'yes',
      ciMethodModifications: 'Adjusted for clustering',
      ciMethodOtherDetail: null,
    });
  });

  it.each([
    [false, 'no'],
    [null, null],
  ])('serves a modifications answer of %s as %s', async (stored, served) => {
    const findDraftState = vi.fn().mockResolvedValue(draftState({ ciMethodModified: stored }));

    const response = await request(createTestApp({ indicators: { findDraftState } }))
      .get(path)
      .set('Cookie', await publisherCookie());

    expect(response.body.ciMethodModified).toBe(served);
  });
});

describe('PUT /api/internal/indicators/:id/confidence-intervals', () => {
  it('writes an unmodified standard method, clearing the answers it does not ask for', async () => {
    const { response, updateDraft } = await put({
      ...everyAnswer,
      ciMethodId: METHODS.standard.id,
      ciMethodModified: 'no',
    });

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith(
      id,
      {
        ciMethodId: METHODS.standard.id,
        ciMethodModified: false,
        ciMethodModifications: null,
        ciMethodOtherDetail: null,
      },
      {},
      'test-user',
    );
  });

  it("writes a modified standard method with its modifications' description", async () => {
    const { updateDraft } = await put({ ...everyAnswer, ciMethodId: METHODS.standard.id });

    expect(updateDraft.mock.calls[0]?.[1]).toEqual({
      ciMethodId: METHODS.standard.id,
      ciMethodModified: true,
      ciMethodModifications: 'Adjusted for clustering',
      ciMethodOtherDetail: null,
    });
  });

  it('writes an other method with its detail, clearing the modifications', async () => {
    const { updateDraft } = await put({ ...everyAnswer, ciMethodId: METHODS.other.id });

    expect(updateDraft.mock.calls[0]?.[1]).toEqual({
      ciMethodId: METHODS.other.id,
      ciMethodModified: null,
      ciMethodModifications: null,
      ciMethodOtherDetail: 'Bootstrap intervals',
    });
  });

  it('writes a method with nothing to describe alone, clearing every follow-up', async () => {
    const { updateDraft } = await put({ ...everyAnswer, ciMethodId: METHODS.none.id });

    expect(updateDraft.mock.calls[0]?.[1]).toEqual({
      ciMethodId: METHODS.none.id,
      ciMethodModified: null,
      ciMethodModifications: null,
      ciMethodOtherDetail: null,
    });
  });

  it('asks for nothing more of a method with nothing to describe', async () => {
    const { response } = await put({
      ciMethodId: METHODS.none.id,
      ciMethodModified: '',
      ciMethodModifications: '',
      ciMethodOtherDetail: '',
    });

    expect(response.status).toBe(200);
  });

  it.each([
    ['no method', { ciMethodId: '' }, { ciMethodId: 'Select the confidence interval method used' }],
    [
      'a method that does not exist',
      { ciMethodId: '00000000-0000-7000-8000-000000000999' },
      { ciMethodId: 'Select the confidence interval method used' },
    ],
    [
      'a standard method with no answer on modifications',
      { ciMethodId: METHODS.standard.id },
      { ciMethodModified: 'Select whether any modifications were used' },
    ],
    [
      'a modified standard method with no description of the modifications',
      { ciMethodId: METHODS.standard.id, ciMethodModified: 'yes', ciMethodModifications: '  ' },
      { ciMethodModifications: 'Enter a description of the modifications used' },
    ],
    [
      'an other method with no detail',
      { ciMethodId: METHODS.other.id, ciMethodOtherDetail: '\n' },
      { ciMethodOtherDetail: 'Enter details of the other confidence interval method used' },
    ],
  ])('refuses %s without writing anything', async (_, answers, fieldErrors) => {
    const updateDraft = vi.fn();

    const { response } = await put(
      { ciMethodModified: '', ciMethodModifications: '', ciMethodOtherDetail: '', ...answers },
      updateDraft,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'validation_failed', fieldErrors });
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('refuses an unchosen method without looking for it', async () => {
    const findById = vi.fn();

    const response = await request(createTestApp({ ciMethods: { findById } }))
      .put(path)
      .set('Cookie', await publisherCookie())
      .send({ ...everyAnswer, ciMethodId: '' });

    expect(response.status).toBe(400);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { ciMethodId: METHODS.none.id },
    { ...everyAnswer, ciMethodId: METHODS.standard.id, ciMethodModified: 'maybe' },
    { ...everyAnswer, ciMethodId: METHODS.other.id, ciMethodOtherDetail: 108 },
  ])('refuses %o, which the form never sends, without writing anything', async (body) => {
    const updateDraft = vi.fn();

    const { response } = await put(body, updateDraft);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_failed');
    expect(updateDraft).not.toHaveBeenCalled();
  });
});
