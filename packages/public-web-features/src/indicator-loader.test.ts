import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadIndicator } from './indicator-loader';

// The loader asks for several shapes; one stub serves whichever the path implies.
function api(get = vi.fn()) {
  const client = {
    get: get.getMockImplementation()
      ? get
      : get.mockImplementation((path: string) => {
          if (path === '/api/indicators') {
            return Promise.resolve({ indicators: [] });
          }
          if (path.startsWith('/api/areas/parents')) {
            return Promise.resolve([]);
          }
          if (path.startsWith('/api/areas')) {
            return Promise.resolve([{ areaType: 'England', areas: [] }]);
          }
          if (path.includes('/range')) {
            return Promise.resolve({ periods: [] });
          }
          // An indicator detail needs area types for the geography groups to be derived.
          // The data schema transforms a single-area response into an array, so the stub
          // returns the post-schema shape the loader actually receives.
          return Promise.resolve(
            path.includes('/data')
              ? [{ areaCode: '', areaName: '', observations: [] }]
              : { areaTypes: [] },
          );
        }),
  } as unknown as ApiClient;
  return { client, get };
}

function loaderArgs(
  client: ApiClient,
  params: Record<string, string> = {},
  url = 'http://localhost/indicators',
): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, client);

  return { context, params, request: new Request(url) } as unknown as LoaderFunctionArgs;
}

describe('loadIndicator', () => {
  it('selects nothing when neither the route nor the query names an indicator', async () => {
    const { client, get } = api();

    const result = await loadIndicator(loaderArgs(client));

    expect(result.selected).toEqual([]);
    expect(result.selection.fingertipsIds).toEqual([]);
    // The area list is still needed to render the filters; the tree always offers
    // every level, so every display area type is requested. The indicator catalogue is
    // NOT fetched — search happens server-side per keystroke, never as a preload.
    expect(get).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/areas\?area_type=.*area_type=GPs$/),
      expect.anything(),
    );
    expect(get).not.toHaveBeenCalledWith('/api/indicators', expect.anything());
  });

  it('treats the route param as a single selection', async () => {
    const { client, get } = api();

    const result = await loadIndicator(
      loaderArgs(client, { fingertipsId: '108' }, 'http://localhost/indicators/108'),
    );

    expect(result.selection.fingertipsIds).toEqual([108]);
    expect(get).toHaveBeenCalledWith('/api/indicators/108', expect.anything());
    expect(get).toHaveBeenCalledWith(
      '/api/indicators/108/data?area_code=E92000001',
      expect.anything(),
    );
  });

  it('loads every indicator named in the query string', async () => {
    const { client, get } = api();

    const result = await loadIndicator(
      loaderArgs(client, {}, 'http://localhost/indicators?is=108&is=90366'),
    );

    expect(result.selection.fingertipsIds).toEqual([108, 90366]);
    expect(get).toHaveBeenCalledWith('/api/indicators/108', expect.anything());
    expect(get).toHaveBeenCalledWith('/api/indicators/90366', expect.anything());
  });

  it('lets a query selection replace the route param', async () => {
    const { client } = api();

    const result = await loadIndicator(
      loaderArgs(client, { fingertipsId: '108' }, 'http://localhost/indicators/108?is=90366'),
    );

    expect(result.selection.fingertipsIds).toEqual([90366]);
  });

  it('drops duplicate and malformed ids and caps the selection', async () => {
    const { client } = api();
    const many = Array.from({ length: 15 }, (_, i) => `is=${100 + i}`).join('&');

    const result = await loadIndicator(
      loaderArgs(client, {}, `http://localhost/indicators?is=108&is=108&is=abc&${many}`),
    );

    expect(result.selection.fingertipsIds).toHaveLength(10);
    expect(result.selection.fingertipsIds.filter((id) => id === 108)).toHaveLength(1);
  });

  it('asks for every selected area in one request per indicator', async () => {
    const { client, get } = api();

    await loadIndicator(
      loaderArgs(
        client,
        {},
        'http://localhost/indicators?is=108&ats=Regions+(statistical)&as=E12000001&as=E12000002',
      ),
    );

    // One call carrying both codes, not one call per code; England rides along last so
    // the benchmark columns always have its series.
    expect(get).toHaveBeenCalledWith(
      '/api/indicators/108/data?area_code=E12000001&area_code=E12000002&area_code=E92000001',
      expect.anything(),
    );
    expect(get.mock.calls.filter(([path]) => String(path).includes('/data?'))).toHaveLength(1);
  });

  it('loads a repeated area code once', async () => {
    const { client, get } = api();

    const result = await loadIndicator(
      loaderArgs(client, {}, 'http://localhost/indicators?is=108&as=E12000001&as=E12000001'),
    );

    expect(result.selection.areaCodes).toEqual(['E12000001']);
    const dataCalls = get.mock.calls.filter(([path]) => String(path).includes('/data?'));
    expect(dataCalls).toHaveLength(1);
    expect(String(dataCalls[0]?.[0])).toBe(
      '/api/indicators/108/data?area_code=E12000001&area_code=E92000001',
    );
  });

  it('404s a non-numeric route param without calling the api for it', async () => {
    const { client } = api();

    await expect(
      loadIndicator(
        loaderArgs(
          client,
          { fingertipsId: '../topics' },
          'http://localhost/indicators/..%2Ftopics',
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('lets the client 404 through so the not-found boundary renders', async () => {
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        path.startsWith('/api/indicators/')
          ? Promise.reject(new Response('Not Found', { status: 404 }))
          : Promise.resolve(path === '/api/indicators' ? { indicators: [] } : []),
      );

    await expect(
      loadIndicator(loaderArgs(api(get).client, { fingertipsId: '424242' })),
    ).rejects.toMatchObject({ status: 404 });
  });
});
