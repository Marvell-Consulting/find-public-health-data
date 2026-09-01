import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loader } from './indicator-search';

function loaderArgs(get: ReturnType<typeof vi.fn>, url: string): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);
  return { context, params: {}, request: new Request(url) } as unknown as LoaderFunctionArgs;
}

describe('indicator search resource route', () => {
  it('answers an empty query with no results and no api call', async () => {
    const get = vi.fn();

    const response = await loader(loaderArgs(get, 'http://localhost/indicators/search?q=+'));

    expect(await response.json()).toEqual({ indicators: [] });
    expect(get).not.toHaveBeenCalled();
  });

  it('passes the query through to the api, encoded', async () => {
    const indicators = [
      { id: 'a', fingertipsId: 241, name: 'Diabetes: QOF prevalence', status: 'approved' },
    ];
    const get = vi.fn().mockResolvedValue({ indicators });

    const response = await loader(
      loaderArgs(get, 'http://localhost/indicators/search?q=diabetes+%26+obesity'),
    );

    expect(get).toHaveBeenCalledWith(
      '/api/indicators?q=diabetes%20%26%20obesity',
      expect.anything(),
    );
    expect(await response.json()).toEqual({ indicators });
  });
});
