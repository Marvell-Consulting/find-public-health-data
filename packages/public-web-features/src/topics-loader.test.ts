import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiContext } from './api-context';
import { loadTopics } from './topics-loader';

function loaderArgs(baseUrl: string): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, { baseUrl });

  return {
    context,
    params: {},
    request: new Request('http://localhost/topics'),
  } as unknown as LoaderFunctionArgs;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadTopics', () => {
  it('fetches topics from the configured api base url and returns the parsed body', async () => {
    const topics = [{ slug: 'a-topic', title: 'A Topic' }];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(topics), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadTopics(loaderArgs('http://localhost:4000'));

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/topics');
    expect(result).toEqual(topics);
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    await expect(loadTopics(loaderArgs('http://localhost:4000'))).rejects.toBeInstanceOf(Response);
  });
});
