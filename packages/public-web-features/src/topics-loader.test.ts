import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadTopics } from './topics-loader';

function loaderArgs(api: ApiClient, params: Record<string, string> = {}): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, api);

  return {
    context,
    params,
    request: new Request('http://localhost/topics'),
  } as unknown as LoaderFunctionArgs;
}

describe('loadTopics', () => {
  it('asks the api for the topic list and returns what the contract schema yields', async () => {
    const topics = [
      {
        slug: 'a-topic',
        title: 'A Topic',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ];
    const get = vi.fn().mockResolvedValue(topics);

    const result = await loadTopics(loaderArgs({ get } as unknown as ApiClient));

    expect(get).toHaveBeenCalledWith('/api/topics', expect.anything());
    expect(result).toEqual(topics);
  });

  it('propagates the failure the client raises rather than returning a partial page', async () => {
    const get = vi.fn().mockRejectedValue(new Response('Bad Gateway', { status: 502 }));

    await expect(loadTopics(loaderArgs({ get } as unknown as ApiClient))).rejects.toBeInstanceOf(
      Response,
    );
  });
});
