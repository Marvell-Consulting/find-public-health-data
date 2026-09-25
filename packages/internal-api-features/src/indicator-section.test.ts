import type { Express } from 'express';
import type { Logger } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  definitionAndRationaleSection,
  otherNotesAndCaveatsSection,
  varianceAndQualitySection,
} from './contract.ts';
import { indicatorSectionRouter, yesNoDetailColumns } from './indicator-section.ts';
import { definitionAndRationaleColumns } from './indicator-sections.ts';
import {
  createCapturingLogger,
  createFakeInternalRepositories,
  createRouterTestApp,
  type FakeInternalRepositoryOverrides,
  handlerLogLines,
  testSessionCookie,
  testSessionVerifier,
} from './testing.ts';

// What every section's endpoints share, shown through the first section built on them.

const id = '00000000-0000-7000-8000-000000000001';
const path = `/api/internal/indicators/${id}/definition-and-rationale`;

const draftState = {
  id,
  shortId: 90366,
  draft: { definition: 'Stored definition', rationale: 'Stored rationale' },
  indicatorStatus: 'new',
  draftStatus: 'draft',
};

const noDraftState = { ...draftState, draft: null, indicatorStatus: 'live', draftStatus: null };

const answers = { definition: 'A definition', rationale: 'A rationale' };

function createTestApp(
  overrides: FakeInternalRepositoryOverrides['indicators'] = {},
  logger?: Logger,
): Express {
  const repositories = createFakeInternalRepositories({ indicators: overrides });

  return createRouterTestApp(
    indicatorSectionRouter(
      repositories.indicators,
      testSessionVerifier,
      definitionAndRationaleSection,
      definitionAndRationaleColumns,
    ),
    logger,
  );
}

function publisherCookie(roles: readonly string[] = ['internal', 'publisher']) {
  return testSessionCookie(roles);
}

describe.each(['get', 'put'] as const)('%s on a section', (method) => {
  it('rejects an anonymous request', async () => {
    const response = await request(createTestApp())[method](path).send(answers);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
  });

  it('rejects a signed-in non-publisher', async () => {
    const response = await request(createTestApp())
      [method](path)
      .set('Cookie', await publisherCookie(['internal']))
      .send(answers);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'forbidden' });
  });

  it('rejects an id that is not a UUID without asking the repository', async () => {
    const findDraftState = vi.fn();
    const updateDraft = vi.fn();

    const response = await request(createTestApp({ findDraftState, updateDraft }))
      [method]('/api/internal/indicators/108/definition-and-rationale')
      .set('Cookie', await publisherCookie())
      .send(answers);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_id' });
    expect(findDraftState).not.toHaveBeenCalled();
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('answers not_found for an indicator that does not exist', async () => {
    const response = await request(
      createTestApp({
        findDraftState: vi.fn().mockResolvedValue(undefined),
        updateDraft: async () => ({ ok: false, reason: 'no_draft' }),
      }),
    )
      [method](path)
      .set('Cookie', await publisherCookie())
      .send(answers);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('answers no_draft for an indicator with no draft to edit', async () => {
    const response = await request(
      createTestApp({
        findDraftState: vi.fn().mockResolvedValue(noDraftState),
        updateDraft: async () => ({ ok: false, reason: 'no_draft' }),
      }),
    )
      [method](path)
      .set('Cookie', await publisherCookie())
      .send(answers);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'no_draft' });
  });
});

describe('GET on a section', () => {
  it("serves the draft's answers", async () => {
    const findDraftState = vi.fn().mockResolvedValue(draftState);

    const response = await request(createTestApp({ findDraftState }))
      .get(path)
      .set('Cookie', await publisherCookie());

    expect(response.status).toBe(200);
    expect(findDraftState).toHaveBeenCalledWith(id);
    expect(response.body).toEqual({
      definition: 'Stored definition',
      rationale: 'Stored rationale',
    });
  });
});

describe('PUT on a section', () => {
  it('writes the answers as the signed-in publisher and serves them back as stored', async () => {
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });
    const findDraftState = vi.fn().mockResolvedValue(draftState);

    const response = await request(createTestApp({ updateDraft, findDraftState }))
      .put(path)
      .set('Cookie', await publisherCookie())
      .send(answers);

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith(id, answers, {}, 'test-user');
    expect(response.body).toEqual({
      definition: 'Stored definition',
      rationale: 'Stored rationale',
    });
  });

  it('writes nothing when any answer is refused, naming each field refused', async () => {
    const updateDraft = vi.fn();

    const response = await request(createTestApp({ updateDraft }))
      .put(path)
      .set('Cookie', await publisherCookie())
      .send({ definition: '', rationale: 108 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'validation_failed',
      fieldErrors: {
        definition: 'Enter the definition of the indicator',
        rationale: 'Invalid input: expected string, received number',
      },
    });
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('logs the save under the request id, by the ids and the section alone', async () => {
    const { logger, lines } = createCapturingLogger();

    const response = await request(
      createTestApp(
        {
          updateDraft: async () => ({ ok: true }),
          findDraftState: vi.fn().mockResolvedValue(draftState),
        },
        logger,
      ),
    )
      .put(path)
      .set('Cookie', await publisherCookie())
      .send(answers);

    expect(await handlerLogLines(lines)).toEqual([
      expect.objectContaining({
        level: 30,
        msg: 'Indicator section saved',
        req: expect.objectContaining({ id: response.headers['x-fphd-request-id'] }),
        indicatorId: id,
        shortId: 90366,
        section: 'definition-and-rationale',
      }),
    ]);
    expect(JSON.stringify(lines)).not.toContain('A definition');
    expect(JSON.stringify(lines)).not.toContain('test-user');
  });

  it('logs nothing when the save is refused', async () => {
    const { logger, lines } = createCapturingLogger();

    await request(
      createTestApp(
        {
          updateDraft: async () => ({ ok: false, reason: 'no_draft' }),
          findDraftState: vi.fn().mockResolvedValue(noDraftState),
        },
        logger,
      ),
    )
      .put(path)
      .set('Cookie', await publisherCookie())
      .send(answers);

    expect(await handlerLogLines(lines)).toEqual([]);
  });
});

// Checked by the typecheck: each @ts-expect-error fails it if the call compiles.
describe('yesNoDetailColumns', () => {
  it('needs a question for every yes/no column', () => {
    yesNoDetailColumns(
      otherNotesAndCaveatsSection,
      // @ts-expect-error otherNotesNeeded is no question's answer
      [
        { answer: 'roundingApplied', detail: 'roundingDetail', detailRequired: 'x' },
        { answer: 'caveatsNeeded', detail: 'caveatsDetail', detailRequired: 'x' },
      ],
    );
    // @ts-expect-error sourceDataIssues is no question's answer
    yesNoDetailColumns(varianceAndQualitySection, []);
  });

  it('takes a yes/no column alone as an answer and a text column alone as details', () => {
    yesNoDetailColumns(otherNotesAndCaveatsSection, [
      // @ts-expect-error disclosureControl is a text column
      { answer: 'disclosureControl', detail: 'disclosureControlDetail', detailRequired: 'x' },
      { answer: 'roundingApplied', detail: 'roundingDetail', detailRequired: 'x' },
      { answer: 'caveatsNeeded', detail: 'caveatsDetail', detailRequired: 'x' },
      { answer: 'otherNotesNeeded', detail: 'otherNotesDetail', detailRequired: 'x' },
    ]);
    yesNoDetailColumns(varianceAndQualitySection, [
      // @ts-expect-error sourceDataIssues is a yes/no column
      { answer: 'sourceDataIssues', detail: 'sourceDataIssues', detailRequired: 'x' },
    ]);
  });
});
