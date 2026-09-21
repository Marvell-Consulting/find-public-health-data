import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadIndicatorTaskList } from './loader.ts';

const taskList = {
  indicator: {
    id: '00000000-0000-7000-8000-000000000001',
    shortId: 90366,
    name: 'Life expectancy at birth',
  },
  isUpdate: false,
  canSubmit: true,
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

  it.each(['108', 'not-an-id'])('answers 404 to an id of %s without asking the API', async (id) => {
    const get = vi.fn();

    await expect(load(id, get)).rejects.toSatisfy(
      (error: unknown) => error instanceof Response && error.status === 404,
    );
    expect(get).not.toHaveBeenCalled();
  });
});
