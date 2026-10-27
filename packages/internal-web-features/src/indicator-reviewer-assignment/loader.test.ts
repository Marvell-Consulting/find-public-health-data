import { TEAM_IDS } from '@fphd/auth';
import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { describe, expect, it, vi } from 'vitest';

import { flashedResponse, redirectWithFlash, withFlashStorage } from '../flash.testing.ts';
import { ADD_INTENT, removeIntent } from '../list-form.ts';
import { signedInContext } from '../session.testing.ts';
import { assignReviewers, loadReviewerAssignment } from './loader.ts';

const ID = '00000000-0000-7000-8000-000000000001';
const PATH = `https://internal.test/dashboard/indicators/${ID}/assign-reviewers`;
const OVERVIEW = `/dashboard/indicators/${ID}`;

const morgan = { id: '019fa38f-073f-764e-9ac6-1c4d03b20001', name: 'Morgan Hughes' };
const jamie = { id: '019fa38f-073f-764e-9ac6-1c4d03b20002', name: 'Jamie Evans' };

const options = [
  { ...jamie, assignedIndicatorCount: 0 },
  { ...morgan, assignedIndicatorCount: 3 },
];

const inReview = {
  id: ID,
  shortId: 90366,
  name: 'Life expectancy at birth',
  teamId: TEAM_IDS.teamA,
  publishedSlug: null,
  updatedAt: '2026-01-02T00:00:00.000Z',
  indicatorStatus: 'new',
  draftStatus: 'draft',
  draftLocked: true,
  draftSubmissionStatus: 'in_review',
  draftReviewers: [morgan],
  draftSubmissionNumber: 2,
  actions: ['assign_reviewers'],
};

function apiGet(indicator: object) {
  return vi
    .fn()
    .mockImplementation(async (path: string) =>
      path.endsWith('/reviewer-options') ? { reviewers: options } : indicator,
    );
}

async function respond(
  handler: (args: never) => Promise<unknown>,
  client: Partial<ApiClient>,
  request: Request,
  roles: readonly string[] = ['imrg-manager'],
) {
  const context = withFlashStorage(await signedInContext(roles));
  context.set(apiContext, client as ApiClient);
  let outcome: unknown;
  const response = await flashedResponse(context, request, async () => {
    outcome = await handler({ context, params: { id: ID }, request } as never);
    return outcome;
  });
  return { outcome, response };
}

describe('loadReviewerAssignment', () => {
  it('opens with the reviewers assigned now, and those on offer', async () => {
    const get = apiGet(inReview);

    const { outcome } = await respond(loadReviewerAssignment, { get }, new Request(PATH));

    expect(get.mock.calls.map(([path]) => path).sort()).toEqual([
      `/api/internal/indicators/${ID}`,
      `/api/internal/indicators/${ID}/reviewer-options`,
    ]);
    expect(outcome).toEqual({
      id: ID,
      options,
      currentReviewers: [morgan],
      values: {
        submissionNumber: 2,
        previousReviewerIds: [morgan.id],
        reviewerIds: [morgan.id],
        addReviewer: '',
      },
    });
  });

  it('sends the manager to the overview, saying why, once reviewers cannot be assigned', async () => {
    const get = apiGet({ ...inReview, actions: [] });

    const { response } = await respond(loadReviewerAssignment, { get }, new Request(PATH));

    expect(await redirectWithFlash(response)).toEqual({
      status: 302,
      location: OVERVIEW,
      flash: 'assign-refused',
    });
  });

  it('is not found for a user who may not assign reviewers, asking the API nothing', async () => {
    const get = apiGet(inReview);

    const { response } = await respond(loadReviewerAssignment, { get }, new Request(PATH), [
      'publisher',
    ]);

    expect(response.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('assignReviewers', () => {
  function post(fields: [string, string][]) {
    return new Request(PATH, { method: 'POST', body: new URLSearchParams(fields) });
  }

  const sent: [string, string][] = [
    ['submissionNumber', '2'],
    ['previousReviewerIds', morgan.id],
    ['reviewerIds', morgan.id],
  ];

  it('adds the chosen reviewer to the page without saving', async () => {
    const { outcome } = await respond(
      assignReviewers,
      {},
      post([...sent, ['addReviewer', jamie.id], ['intent', ADD_INTENT]]),
    );

    expect(outcome).toEqual({
      values: {
        submissionNumber: 2,
        previousReviewerIds: [morgan.id],
        reviewerIds: [morgan.id, jamie.id],
        addReviewer: '',
      },
      fieldErrors: {},
    });
  });

  it('removes a reviewer from the page without saving', async () => {
    const { outcome } = await respond(
      assignReviewers,
      {},
      post([...sent, ['addReviewer', ''], ['intent', removeIntent(0)]]),
    );

    expect(outcome).toMatchObject({ values: { reviewerIds: [] }, fieldErrors: {} });
  });

  it('asks for a reviewer when Continue is pressed with none', async () => {
    const { outcome } = await respond(
      assignReviewers,
      {},
      post([
        ['submissionNumber', '2'],
        ['addReviewer', ''],
      ]),
    );

    expect(outcome).toMatchObject({ fieldErrors: { addReviewer: 'Select a reviewer' } });
  });

  it('assigns the listed reviewers, naming what the page showed, then says so on the overview', async () => {
    const postToMember = vi.fn().mockResolvedValue({ ok: true, data: undefined });

    const { response } = await respond(
      assignReviewers,
      { postToMember },
      post([...sent, ['addReviewer', jamie.id]]),
    );

    expect(postToMember.mock.calls[0]?.slice(0, 2)).toEqual([
      `/api/internal/indicators/${ID}/assign-reviewers`,
      { submissionNumber: 2, previousReviewerIds: [morgan.id], reviewerIds: [morgan.id, jamie.id] },
    ]);
    expect(await redirectWithFlash(response)).toEqual({
      status: 302,
      location: OVERVIEW,
      flash: 'reviewers-assigned',
    });
  });

  it.each([
    ['not_allowed', 'assign-refused'],
    ['changed', 'reviewers-changed'],
    ['not_a_reviewer', 'reviewer-refused'],
  ])('says on the overview why a stale page was refused with %s', async (error, flash) => {
    const postToMember = vi.fn().mockResolvedValue({ ok: false, status: 409, error: { error } });

    const { response } = await respond(assignReviewers, { postToMember }, post(sent));

    expect(await redirectWithFlash(response)).toEqual({ status: 302, location: OVERVIEW, flash });
  });

  it('asks for a reviewer when the API answers no_reviewers', async () => {
    const postToMember = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, error: { error: 'no_reviewers' } });

    const { outcome } = await respond(assignReviewers, { postToMember }, post(sent));

    expect(outcome).toMatchObject({ fieldErrors: { addReviewer: 'Select a reviewer' } });
  });

  it('says the reviewers were not saved for a refusal that names no field', async () => {
    const postToMember = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, error: { error: 'duplicate_reviewers' } });

    const { outcome } = await respond(assignReviewers, { postToMember }, post(sent));

    expect(outcome).toMatchObject({
      fieldErrors: {},
      formError: 'Your answers could not be saved. Try again.',
    });
  });

  it('is not found for a user who may not assign reviewers', async () => {
    const postToMember = vi.fn();

    const { response } = await respond(assignReviewers, { postToMember }, post(sent), [
      'publisher',
    ]);

    expect(response.status).toBe(404);
    expect(postToMember).not.toHaveBeenCalled();
  });
});
