import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadIndicatorOverview } from './loader';

const indicator = {
  id: '00000000-0000-7000-8000-000000000001',
  shortId: 90366,
  name: 'Life expectancy at birth',
  status: 'approved',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function load(id: string, get: ApiClient['get']) {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);

  return loadIndicatorOverview({
    context,
    params: { id },
    request: new Request(`https://internal.test/dashboard/indicators/${id}`),
  } as never);
}

describe('loadIndicatorOverview', () => {
  it('fetches the indicator the address names', async () => {
    const get = vi.fn().mockResolvedValue(indicator);

    const outcome = await load(indicator.id, get);

    expect(get.mock.calls[0]?.[0]).toBe(`/api/internal/indicators/${indicator.id}`);
    expect(outcome).toEqual({ indicator });
  });

  it.each(['108', 'not-an-id'])(
    'responds 404 to an id of %s without asking the API',
    async (id) => {
      const get = vi.fn();

      await expect(load(id, get)).rejects.toSatisfy(
        (error: unknown) => error instanceof Response && error.status === 404,
      );
      expect(get).not.toHaveBeenCalled();
    },
  );
});
