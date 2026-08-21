import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadTopic, loadTopics } from './topics-loader';

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
        description: 'All about a topic.',
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

describe('loadTopic', () => {
  it('requests the topic by slug', async () => {
    const get = vi.fn().mockResolvedValue({});

    await loadTopic(loaderArgs({ get } as unknown as ApiClient, { slug: 'topic-a' }));

    expect(get).toHaveBeenCalledWith('/api/topics/topic-a', expect.anything());
  });

  it.each([['../internal'], ['../../health']])(
    'escapes a slug of %s so it cannot traverse onto another api route',
    async (slug) => {
      const get = vi.fn().mockResolvedValue({});

      await loadTopic(loaderArgs({ get } as unknown as ApiClient, { slug }));

      // The guarantee that matters: whatever the slug, the request stays under /api/topics/.
      expect(String(get.mock.calls[0]?.[0])).toMatch(/^\/api\/topics\/[^/]+$/);
    },
  );

  it('fails with a developer-facing error when the route supplies no slug', async () => {
    const get = vi.fn();

    await expect(loadTopic(loaderArgs({ get } as unknown as ApiClient))).rejects.toThrow(
      /expects a slug param/,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('lets the client 404 through so the not-found boundary renders', async () => {
    const get = vi.fn().mockRejectedValue(new Response('Not Found', { status: 404 }));

    await expect(
      loadTopic(loaderArgs({ get } as unknown as ApiClient, { slug: 'nope' })),
    ).rejects.toMatchObject({ status: 404 });
  });
});
