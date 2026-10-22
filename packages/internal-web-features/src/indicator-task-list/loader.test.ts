import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { flashedResponse, redirectWithFlash, withFlashStorage } from '../flash.testing.ts';
import { loadIndicatorTaskList } from './loader.ts';

const taskList = {
  indicator: {
    id: '00000000-0000-7000-8000-000000000001',
    shortId: 90366,
    name: 'Life expectancy at birth',
    indicatorStatus: 'new',
    draftStatus: 'draft',
    draftSubmissionStatus: null,
  },
  isUpdate: false,
  canSubmit: true,
  draftUpdatedAt: '2026-10-22T09:30:00.123Z',
  editable: true,
  actions: ['submit'],
  tasks: { name: 'completed' },
};

function load(id: string, get: ApiClient['get']) {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);

  return loadIndicatorTaskList({
    context,
    params: { id },
    request: new Request(`https://internal.test/publish/indicators/${id}/task-list`),
  } as never);
}

describe('loadIndicatorTaskList', () => {
  it('fetches the task list of the indicator the address names', async () => {
    const get = vi.fn().mockResolvedValue(taskList);

    const outcome = await load(taskList.indicator.id, get);

    expect(get.mock.calls[0]?.[0]).toBe(
      `/api/internal/indicators/${taskList.indicator.id}/task-list`,
    );
    expect(outcome).toEqual({ taskList });
  });

  it('sends the publisher to the overview, saying why, while the draft is locked', async () => {
    const id = taskList.indicator.id;
    const context = withFlashStorage(new RouterContextProvider());
    context.set(apiContext, {
      get: vi.fn().mockResolvedValue({ ...taskList, editable: false }),
    } as unknown as ApiClient);
    const request = new Request(`https://internal.test/publish/indicators/${id}/task-list`);

    const response = await flashedResponse(context, request, () =>
      loadIndicatorTaskList({ context, params: { id }, request } as never),
    );

    expect(await redirectWithFlash(response)).toEqual({
      status: 302,
      location: `/dashboard/indicators/${id}`,
      flash: 'draft-locked',
    });
  });
});
