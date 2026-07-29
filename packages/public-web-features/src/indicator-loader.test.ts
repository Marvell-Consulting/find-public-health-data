import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadIndicator } from './indicator-loader';

function loaderArgs(
  api: ApiClient,
  params: Record<string, string> = {},
  url = 'http://localhost/indicators/108',
): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, api);

  return {
    context,
    params,
    request: new Request(url),
  } as unknown as LoaderFunctionArgs;
}

describe('loadIndicator', () => {
  it('loads detail, the England area list and England data when nothing is selected', async () => {
    const get = vi.fn().mockResolvedValue([]);

    const result = await loadIndicator(
      loaderArgs({ get } as unknown as ApiClient, { fingertipsId: '108' }),
    );

    expect(get).toHaveBeenCalledWith('/api/indicators/108', expect.anything());
    expect(get).toHaveBeenCalledWith('/api/areas?area_type=England', expect.anything());
    expect(get).toHaveBeenCalledWith(
      '/api/indicators/108/data?area_code=E92000001',
      expect.anything(),
    );
    expect(result.selection).toEqual({ areaType: 'England', areaCodes: [] });
  });

  it('loads the selected area type and one data set per selected area', async () => {
    const get = vi.fn().mockResolvedValue([]);

    const result = await loadIndicator(
      loaderArgs(
        { get } as unknown as ApiClient,
        { fingertipsId: '108' },
        'http://localhost/indicators/108?ats=Regions+(statistical)&as=E12000001&as=E12000002',
      ),
    );

    expect(get).toHaveBeenCalledWith(
      `/api/areas?area_type=${encodeURIComponent('Regions (statistical)')}`,
      expect.anything(),
    );
    expect(get).toHaveBeenCalledWith(
      '/api/indicators/108/data?area_code=E12000001',
      expect.anything(),
    );
    expect(get).toHaveBeenCalledWith(
      '/api/indicators/108/data?area_code=E12000002',
      expect.anything(),
    );
    expect(result.selection).toEqual({
      areaType: 'Regions (statistical)',
      areaCodes: ['E12000001', 'E12000002'],
    });
  });

  it('drops malformed area codes and caps the selection', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const codes = Array.from({ length: 30 }, (_, i) => `as=E${String(i).padStart(8, '0')}`);

    const result = await loadIndicator(
      loaderArgs(
        { get } as unknown as ApiClient,
        { fingertipsId: '108' },
        `http://localhost/indicators/108?as=../nope&${codes.join('&')}`,
      ),
    );

    expect(result.selection.areaCodes).toHaveLength(20);
    expect(result.selection.areaCodes).not.toContain('../nope');
  });

  it.each([['../topics'], ['../../health']])(
    'escapes a param of %s so it cannot traverse onto another api route',
    async (fingertipsId) => {
      const get = vi.fn().mockResolvedValue([]);

      await loadIndicator(loaderArgs({ get } as unknown as ApiClient, { fingertipsId }));

      // The guarantee that matters: whatever the param, indicator requests stay under
      // /api/indicators/.
      for (const call of get.mock.calls) {
        expect(String(call[0])).toMatch(/^\/api\/(indicators\/[^/]+(\/data\?.*)?|areas\?.*)$/);
      }
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
