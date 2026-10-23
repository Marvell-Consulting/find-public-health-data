import { TEAM_IDS } from '@fphd/auth';
import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { describe, expect, it, vi } from 'vitest';

import { flashedResponse, redirectWithFlash, withFlashStorage } from '../flash.testing.ts';
import { signedInContext } from '../session.testing.ts';
import { loadIndicatorWithdrawal, withdrawSubmission } from './loader.ts';

const ID = '00000000-0000-7000-8000-000000000001';
const PATH = `https://internal.test/publish/indicators/${ID}/withdraw-submission`;

const submitted = {
  id: ID,
  shortId: 90366,
  name: 'Life expectancy at birth',
  teamId: TEAM_IDS.teamA,
  publishedSlug: null,
  updatedAt: '2026-01-02T00:00:00.000Z',
  indicatorStatus: 'new',
  draftStatus: 'draft',
  draftLocked: true,
  draftSubmissionStatus: 'submitted',
  draftSubmissionNumber: 2,
  actions: ['withdraw'],
};

async function respond(
  handler: (args: never) => Promise<unknown>,
  client: Partial<ApiClient>,
  request: Request,
  teams: readonly string[] = [TEAM_IDS.teamA],
) {
  const context = withFlashStorage(await signedInContext(['publisher'], teams));
  context.set(apiContext, client as ApiClient);
  let outcome: unknown;
  const response = await flashedResponse(context, request, async () => {
    outcome = await handler({ context, params: { id: ID }, request } as never);
    return outcome;
  });
  return { outcome, response };
}

describe('loadIndicatorWithdrawal', () => {
  it('asks about the submission the publisher may withdraw', async () => {
    const get = vi.fn().mockResolvedValue(submitted);

    const { outcome } = await respond(loadIndicatorWithdrawal, { get }, new Request(PATH));

    expect(get.mock.calls[0]?.[0]).toBe(`/api/internal/indicators/${ID}`);
    expect(outcome).toEqual({ id: ID, submissionNumber: 2 });
  });

  it('sends the publisher to the overview, saying why, once it cannot be withdrawn', async () => {
    const get = vi.fn().mockResolvedValue({
      ...submitted,
      draftLocked: false,
      draftSubmissionStatus: 'withdrawn',
      actions: ['submit'],
    });

    const { response } = await respond(loadIndicatorWithdrawal, { get }, new Request(PATH));

    expect(await redirectWithFlash(response)).toEqual({
      status: 302,
      location: `/dashboard/indicators/${ID}`,
      flash: 'withdraw-refused',
    });
  });

  it('is not found for a draft never submitted', async () => {
    const get = vi.fn().mockResolvedValue({
      ...submitted,
      draftLocked: false,
      draftSubmissionStatus: null,
      draftSubmissionNumber: null,
      actions: ['submit'],
    });

    const { response } = await respond(loadIndicatorWithdrawal, { get }, new Request(PATH));

    expect(response.status).toBe(404);
  });

  it("is not found for another team's indicator, which the publisher may not edit", async () => {
    const get = vi.fn().mockResolvedValue(submitted);

    const { response } = await respond(loadIndicatorWithdrawal, { get }, new Request(PATH), [
      TEAM_IDS.teamB,
    ]);

    expect(response.status).toBe(404);
  });
});

describe('withdrawSubmission', () => {
  function post(body: Record<string, string>) {
    return new Request(PATH, { method: 'POST', body: new URLSearchParams(body) });
  }

  it('withdraws the submission the page showed, then says so on the overview', async () => {
    const postToMember = vi.fn().mockResolvedValue({ ok: true, data: undefined });

    const { response } = await respond(
      withdrawSubmission,
      { postToMember },
      post({ submissionNumber: '2' }),
    );

    expect(postToMember.mock.calls[0]?.slice(0, 2)).toEqual([
      `/api/internal/indicators/${ID}/withdraw`,
      { submissionNumber: 2 },
    ]);
    expect(await redirectWithFlash(response)).toEqual({
      status: 302,
      location: `/dashboard/indicators/${ID}`,
      flash: 'submission-withdrawn',
    });
  });

  it.each([
    [409, 'not_allowed'],
    [409, 'changed'],
    [400, 'invalid_submission_number'],
  ])(
    'says on the overview that it cannot be withdrawn when the API answers %s %s',
    async (status, error) => {
      const postToMember = vi.fn().mockResolvedValue({ ok: false, status, error: { error } });

      const { response } = await respond(
        withdrawSubmission,
        { postToMember },
        post({ submissionNumber: '1' }),
      );

      expect(await redirectWithFlash(response)).toEqual({
        status: 302,
        location: `/dashboard/indicators/${ID}`,
        flash: 'withdraw-refused',
      });
    },
  );
});
