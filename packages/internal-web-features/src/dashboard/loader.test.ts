import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadDashboard } from './loader';

const indicator = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Life expectancy at birth',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function load(url: string, get: ApiClient['get']) {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);

  return loadDashboard({ context, params: {}, request: new Request(url) } as never);
}

function apiPage(page: number, total: number, indicators = [indicator]) {
  return vi.fn().mockResolvedValue({ indicators, page, pageSize: 10, total });
}

describe('loadDashboard', () => {
  it('asks for the first page when the address names none', async () => {
    const get = apiPage(1, 23);

    const outcome = await load('https://internal.test/dashboard', get);

    expect(get.mock.calls[0]?.[0]).toBe('/api/internal/indicators?page=1');
    expect(outcome).toEqual({ indicators: [indicator], page: 1, totalPages: 3 });
  });

  it('asks for the page in the address', async () => {
    const get = apiPage(3, 23);

    const outcome = await load('https://internal.test/dashboard?page=3', get);

    expect(get.mock.calls[0]?.[0]).toBe('/api/internal/indicators?page=3');
    expect(outcome).toMatchObject({ page: 3, totalPages: 3 });
  });

  it('renders the first page when there are no indicators at all', async () => {
    const outcome = await load('https://internal.test/dashboard', apiPage(1, 0, []));

    expect(outcome).toEqual({ indicators: [], page: 1, totalPages: 1 });
  });

  it('responds 404 to a page past the last one', async () => {
    await expect(
      load('https://internal.test/dashboard?page=4', apiPage(4, 23, [])),
    ).rejects.toSatisfy((error: unknown) => error instanceof Response && error.status === 404);
  });

  it.each(['0', 'two', '1.5'])(
    'responds 404 to a page of %s without asking the API',
    async (page) => {
      const get = vi.fn();

      await expect(load(`https://internal.test/dashboard?page=${page}`, get)).rejects.toSatisfy(
        (error: unknown) => error instanceof Response && error.status === 404,
      );
      expect(get).not.toHaveBeenCalled();
    },
  );
});
