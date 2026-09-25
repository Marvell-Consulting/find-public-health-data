import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import { createFakeRepositories } from '@fphd/db/testing';
import { indicatorTaskKeySchema } from '@fphd/internal-api-features/contract';
import { createFakeInternalRepositories } from '@fphd/internal-api-features/testing';
import { createLogger } from '@fphd/logger';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from './app.ts';

const session = createJwtSessionService({
  audience: 'fphd-internal',
  clock: () => new Date('2026-07-23T10:00:00.000Z'),
  cookieName: 'fphd-internal-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});
const verifier = createJwtSessionVerifier(session);
const logger = createLogger({ name: 'internal-api', level: 'silent' });

function createTestApp(
  repositories = createFakeRepositories(),
  internalRepositories = createFakeInternalRepositories(),
) {
  return createApp({ logger, repositories, internalRepositories, session: verifier });
}

const app = createTestApp();

// A draft as the name page leaves it: every section's columns unanswered.
const unansweredDraft = {
  definition: null,
  rationale: null,
  polarity: null,
  methodology: null,
  calculatedBy: null,
  calculatedByOther: null,
  ciMethodId: null,
  ciMethodModified: null,
  ciMethodModifications: null,
  ciMethodOtherDetail: null,
  updateFrequency: null,
  disclosureControl: null,
  disclosureControlDetail: null,
  roundingApplied: null,
  roundingDetail: null,
  caveatsNeeded: null,
  caveatsDetail: null,
  otherNotesNeeded: null,
  otherNotesDetail: null,
  scheduledPublishAtUk: null,
  hasLinks: null,
  links: [],
  variation: null,
  qualityAssurance: null,
  sourceDataIssues: null,
  sourceDataIssuesDetail: null,
  ciMethodJustification: null,
  dataSourcesJustification: null,
  inequalitiesIncluded: null,
  hasExclusions: null,
  exclusionsDetail: null,
  automationUsed: null,
  automationDetail: null,
  sponsorsAndStakeholders: null,
  hasReviewerComments: null,
  reviewerCommentsDetail: null,
};

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

  // The superset rule is structural — both apps mount publicApiRoutes — but assert it here
  // so a route added to the public surface alone would fail rather than silently 404.
  it('serves the public indicators surface', async () => {
    const repositories = createFakeRepositories({ indicators: { listPublished: async () => [] } });

    const response = await request(createTestApp(repositories)).get('/api/indicators');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ indicators: [] });
  });

  // Each section is found from the contract, so a new one is checked without an entry here.
  it.each([
    '/api/internal/indicators',
    '/api/internal/ci-methods',
    ...indicatorTaskKeySchema.options
      .filter((key) => key !== 'name')
      .map((key) => `/api/internal/indicators/00000000-0000-7000-8000-000000000001/${key}`),
  ])('mounts %s behind the publisher role', async (path) => {
    const internalRepositories = createFakeInternalRepositories({
      indicators: {
        listPage: async () => ({ indicators: [], total: 0 }),
        // The handlers read only the draft's section columns.
        findDraftState: vi.fn().mockResolvedValue({ draft: unansweredDraft }),
      },
      ciMethods: { list: async () => [] },
    });
    const app = createTestApp(createFakeRepositories(), internalRepositories);

    const asPublisher = await request(app)
      .get(path)
      .set('Cookie', await createCookie(['public', 'internal', 'publisher']));
    const asInternal = await request(app)
      .get(path)
      .set('Cookie', await createCookie(['public', 'internal']));

    expect(asPublisher.status).toBe(200);
    expect(asInternal.status).toBe(403);
  });

  it('mounts the internal topics surface behind the admin role', async () => {
    const internalRepositories = createFakeInternalRepositories({
      topics: {
        list: async () => [
          {
            id: '00000000-0000-7000-8000-000000000001',
            slug: 'topic-a',
            title: 'Topic A',
            description: 'All about topic A.',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T00:00:00.000Z'),
          },
        ],
      },
    });
    const app = createTestApp(createFakeRepositories(), internalRepositories);

    const asAdmin = await request(app)
      .get('/api/internal/topics')
      .set('Cookie', await createCookie(['public', 'internal', 'publisher', 'admin']));
    const asPublisher = await request(app)
      .get('/api/internal/topics')
      .set('Cookie', await createCookie(['public', 'internal', 'publisher']));

    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body[0]).toMatchObject({ id: '00000000-0000-7000-8000-000000000001' });
    expect(asPublisher.status).toBe(403);
  });

  it('serves the public topics surface without a session', async () => {
    const repositories = createFakeRepositories({
      topics: {
        list: async () => [
          {
            id: '00000000-0000-7000-8000-000000000001',
            slug: 'topic-a',
            title: 'Topic A',
            description: 'All about topic A.',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T00:00:00.000Z'),
          },
        ],
      },
    });

    const response = await request(createTestApp(repositories)).get('/api/topics');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        slug: 'topic-a',
        title: 'Topic A',
        description: 'All about topic A.',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]);
  });
});
