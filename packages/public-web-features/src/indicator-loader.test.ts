import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadIndicator } from './indicator-loader';

function loaderArgs(api: ApiClient, params: Record<string, string> = {}): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, api);

  return {
    context,
    params,
    request: new Request('http://localhost/indicators/108'),
  } as unknown as LoaderFunctionArgs;
}

describe('loadIndicator', () => {
  it('requests the indicator by its fingertips id', async () => {
    const get = vi.fn().mockResolvedValue({});

    await loadIndicator(loaderArgs({ get } as unknown as ApiClient, { fingertipsId: '108' }));

    expect(get).toHaveBeenCalledWith('/api/indicators/108', expect.anything());
  });

  it.each([['../topics'], ['../../health']])(
    'escapes a param of %s so it cannot traverse onto another api route',
    async (fingertipsId) => {
      const get = vi.fn().mockResolvedValue({});

      await loadIndicator(loaderArgs({ get } as unknown as ApiClient, { fingertipsId }));

      // The guarantee that matters: whatever the param, the request stays under /api/indicators/.
      expect(String(get.mock.calls[0]?.[0])).toMatch(/^\/api\/indicators\/[^/]+$/);
    },
  );

  it('fails with a developer-facing error when the route supplies no param', async () => {
    const get = vi.fn();

    await expect(loadIndicator(loaderArgs({ get } as unknown as ApiClient))).rejects.toThrow(
      /expects a fingertipsId param/,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('lets the client 404 through so the not-found boundary renders', async () => {
    const get = vi.fn().mockRejectedValue(new Response('Not Found', { status: 404 }));

    await expect(
      loadIndicator(loaderArgs({ get } as unknown as ApiClient, { fingertipsId: '424242' })),
    ).rejects.toMatchObject({ status: 404 });
  });
});
