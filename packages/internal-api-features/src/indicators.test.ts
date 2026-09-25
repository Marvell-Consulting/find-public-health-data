import type { Express } from 'express';
import type { Logger } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { IndicatorAdminDetailRow, IndicatorAdminRow } from './indicator-repository.ts';
import { INDICATORS_PAGE_SIZE, internalIndicatorsRouter } from './indicators.ts';
import {
  createCapturingLogger,
  createFakeInternalRepositories,
  createRouterTestApp,
  type FakeInternalRepositoryOverrides,
  handlerLogLines,
  testSessionCookie,
  testSessionVerifier,
} from './testing.ts';

const row: IndicatorAdminRow = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Life expectancy at birth',
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  indicatorStatus: 'live',
  draftStatus: null,
};

const detailRow: IndicatorAdminDetailRow = {
  ...row,
  shortId: 90366,
  publishedSlug: 'life-expectancy-at-birth',
};

// Inside `createApiApp`, whose request logging gives the handlers their `request.log`.
function createTestApp(
  overrides: FakeInternalRepositoryOverrides['indicators'] = {},
  logger?: Logger,
): Express {
  const repositories = createFakeInternalRepositories({ indicators: overrides });

  return createRouterTestApp(
    internalIndicatorsRouter(repositories.indicators, testSessionVerifier),
    logger,
  );
}

function publisherCookie(roles: readonly string[] = ['internal', 'publisher']) {
  return testSessionCookie(roles);
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
          indicatorStatus: 'live',
          draftStatus: null,
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

  it('serves the indicator with its public identifiers and derived statuses', async () => {
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
      updatedAt: '2026-01-02T00:00:00.000Z',
      indicatorStatus: 'live',
      draftStatus: null,
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
    indicatorStatus: 'new',
    draftStatus: 'draft',
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
      indicatorStatus: 'new',
      draftStatus: 'draft',
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

  it('refuses a name over 300 characters without creating anything', async () => {
    const createDraft = vi.fn();

    const response = await request(createTestApp({ createDraft }))
      .post('/api/internal/indicators')
      .set('Cookie', await publisherCookie())
      .send({ name: 'a'.repeat(301) });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'validation_failed',
      fieldErrors: { name: 'Indicator name must be 300 characters or fewer' },
    });
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('logs the creation under the request id, by the ids alone', async () => {
    const { logger, lines } = createCapturingLogger();
    const createDraft = vi.fn().mockResolvedValue(created);

    const response = await request(
      createTestApp({ createDraft, findById: async () => draftRow }, logger),
    )
      .post('/api/internal/indicators')
      .set('Cookie', await publisherCookie())
      .send({ name: 'Life expectancy at birth' });

    expect(await handlerLogLines(lines)).toEqual([
      expect.objectContaining({
        level: 30,
        msg: 'Indicator created',
        req: expect.objectContaining({ id: response.headers['x-fphd-request-id'] }),
        indicatorId: row.id,
        shortId: 90366,
      }),
    ]);
    expect(JSON.stringify(lines)).not.toContain('Life expectancy');
    expect(JSON.stringify(lines)).not.toContain('test-user');
  });

  it('logs nothing when the name is taken', async () => {
    const { logger, lines } = createCapturingLogger();

    await request(
      createTestApp({ createDraft: async () => ({ ok: false, reason: 'slug_taken' }) }, logger),
    )
      .post('/api/internal/indicators')
      .set('Cookie', await publisherCookie())
      .send({ name: 'Life expectancy at birth' });

    expect(await handlerLogLines(lines)).toEqual([]);
  });
});

describe('PATCH /api/internal/indicators/:id', () => {
  const draftRow: IndicatorAdminDetailRow = {
    ...row,
    shortId: 90366,
    publishedSlug: null,
    indicatorStatus: 'new',
    draftStatus: 'draft',
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
      indicatorStatus: 'new',
      draftStatus: 'draft',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
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

  it('answers not_found when there is no indicator to rename', async () => {
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

  it('reports a name another indicator already holds against the field, reading nothing back', async () => {
    const findById = vi.fn();

    const response = await request(
      createTestApp({
        updateDraft: async () => ({ ok: false, reason: 'slug_taken' }),
        findById,
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
    expect(findById).not.toHaveBeenCalled();
  });

  it('answers 404 for an indicator with no draft to rename', async () => {
    const response = await request(
      createTestApp({
        updateDraft: async () => ({ ok: false, reason: 'no_draft' }),
        findById: async () => detailRow,
      }),
    )
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: 'A better name' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'no_draft' });
  });

  it('refuses a name over 300 characters without touching the repository', async () => {
    const updateDraft = vi.fn();

    const response = await request(createTestApp({ updateDraft }))
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: 'a'.repeat(301) });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'validation_failed',
      fieldErrors: { name: 'Indicator name must be 300 characters or fewer' },
    });
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('logs the rename under the request id, by the ids alone', async () => {
    const { logger, lines } = createCapturingLogger();

    const response = await request(
      createTestApp(
        { updateDraft: async () => ({ ok: true }), findById: async () => draftRow },
        logger,
      ),
    )
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: 'A better name' });

    expect(await handlerLogLines(lines)).toEqual([
      expect.objectContaining({
        level: 30,
        msg: 'Indicator renamed',
        req: expect.objectContaining({ id: response.headers['x-fphd-request-id'] }),
        indicatorId: row.id,
        shortId: 90366,
      }),
    ]);
    expect(JSON.stringify(lines)).not.toContain('A better name');
    expect(JSON.stringify(lines)).not.toContain('test-user');
  });

  it('logs nothing when the rename is refused', async () => {
    const { logger, lines } = createCapturingLogger();

    await request(
      createTestApp(
        {
          updateDraft: async () => ({ ok: false, reason: 'slug_taken' }),
          findById: async () => draftRow,
        },
        logger,
      ),
    )
      .patch(path)
      .set('Cookie', await publisherCookie())
      .send({ name: 'Life expectancy at birth' });

    expect(await handlerLogLines(lines)).toEqual([]);
  });
});

describe('GET /api/internal/indicators/:id/task-list', () => {
  // The handler reads the columns the task list judges; the rest of the row is beside the point.
  const draftState = {
    id: row.id,
    shortId: 90366,
    draft: {
      name: 'Life expectancy at birth',
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
      sexes: null,
      ageType: null,
      ageRanges: [],
      specificAge: null,
      specificAgeUnit: null,
      ageOtherDetail: null,
    },
    draftCiMethodKind: null,
    indicatorStatus: 'new',
    draftStatus: 'draft',
  };

  it('rejects an anonymous request', async () => {
    const response = await request(createTestApp()).get(
      `/api/internal/indicators/${row.id}/task-list`,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it('rejects a signed-in non-publisher', async () => {
    const response = await request(createTestApp())
      .get(`/api/internal/indicators/${row.id}/task-list`)
      .set('Cookie', await publisherCookie(['internal']));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });

  it('serves the draft as a task list', async () => {
    const findDraftState = vi.fn().mockResolvedValue(draftState);

    const response = await request(createTestApp({ findDraftState }))
      .get(`/api/internal/indicators/${row.id}/task-list`)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(findDraftState).toHaveBeenCalledWith(row.id);
    expect(response.body).toEqual({
      indicator: {
        id: row.id,
        shortId: 90366,
        name: 'Life expectancy at birth',
        indicatorStatus: 'new',
        draftStatus: 'draft',
      },
      isUpdate: false,
      canSubmit: false,
      tasks: {
        name: 'completed',
        'definition-and-rationale': 'not_started',
        polarity: 'not_started',
        calculation: 'not_started',
        'confidence-intervals': 'not_started',
        'update-frequency': 'not_started',
        'other-notes-and-caveats': 'not_started',
        'publishing-date': 'not_started',
        links: 'not_started',
        'sex-and-ages': 'not_started',
      },
    });
  });

  it("judges the confidence intervals by the kind of the draft's method", async () => {
    const findDraftState = vi.fn().mockResolvedValue({
      ...draftState,
      draft: { ...draftState.draft, ciMethodId: '019fa38f-0747-73bb-b8a4-bb6e8f3c244e' },
      draftCiMethodKind: 'none',
    });

    const response = await request(createTestApp({ findDraftState }))
      .get(`/api/internal/indicators/${row.id}/task-list`)
      .set('Cookie', await publisherCookie());

    expect(response.body.tasks['confidence-intervals']).toBe('completed');
  });

  it('reports a draft behind a published version as an update of a live indicator', async () => {
    const findDraftState = vi.fn().mockResolvedValue({ ...draftState, indicatorStatus: 'live' });

    const response = await request(createTestApp({ findDraftState }))
      .get(`/api/internal/indicators/${row.id}/task-list`)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      indicator: { indicatorStatus: 'live', draftStatus: 'draft' },
      isUpdate: true,
    });
  });

  it('answers 404 for an indicator that does not exist', async () => {
    const findDraftState = vi.fn().mockResolvedValue(undefined);

    const response = await request(createTestApp({ findDraftState }))
      .get('/api/internal/indicators/00000000-0000-7000-8000-000000000000/task-list')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('answers 404 for an indicator with no draft to edit', async () => {
    const findDraftState = vi.fn().mockResolvedValue({
      ...draftState,
      draft: null,
      indicatorStatus: 'live',
      draftStatus: null,
    });

    const response = await request(createTestApp({ findDraftState }))
      .get(`/api/internal/indicators/${row.id}/task-list`)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'no_draft' });
  });

  it('rejects an id that is not a UUID without asking the repository', async () => {
    const findDraftState = vi.fn();

    const response = await request(createTestApp({ findDraftState }))
      .get('/api/internal/indicators/108/task-list')
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_id' });
    expect(findDraftState).not.toHaveBeenCalled();
  });
});
