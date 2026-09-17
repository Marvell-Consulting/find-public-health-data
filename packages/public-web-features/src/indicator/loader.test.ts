import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadIndicator } from './loader';

/** The seed's aliases in miniature: every indicator answers to its number and to a slug. */
function slugFor(number: string): string {
  return `indicator-${number}`;
}

function detailFor(alias: string) {
  const number = /^\d+$/.test(alias) ? Number(alias) : Number(alias.replace('indicator-', ''));
  return { slug: slugFor(String(number)), number, areaTypes: [] };
}

// The loader asks for several shapes; one stub serves whichever the path implies.
function api(get = vi.fn()) {
  const client = {
    getOrRedirect: vi.fn((path: string) => {
      const alias = path.slice('/api/indicators/'.length);
      const detail = detailFor(alias);

      return Promise.resolve(
        alias === detail.slug
          ? { redirected: false, data: detail }
          : { redirected: true, location: `/api/indicators/${detail.slug}` },
      );
    }),
    get: get.getMockImplementation()
      ? get
      : get.mockImplementation((path: string) => {
          if (path === '/api/indicators' || path.startsWith('/api/indicators?')) {
            return Promise.resolve({
              indicators: path.includes('q=')
                ? [
                    {
                      slug: 'diabetes-qof-prevalence',
                      number: 241,
                      name: 'Diabetes: QOF prevalence',
                    },
                  ]
                : [],
            });
          }
          if (path === '/api/areas/display-groups') {
            return Promise.resolve([
              'Local authorities',
              'Statistical regions',
              'NHS regions',
              'Integrated care boards',
              'Middle-layer super output areas',
              'GP practices',
            ]);
          }
          if (path.startsWith('/api/areas/parents')) {
            return Promise.resolve([]);
          }
          if (path.startsWith('/api/areas/lookup')) {
            const codes = [...new URL(`http://x${path}`).searchParams.getAll('areaCode')];
            return Promise.resolve(
              codes.map((code) => ({
                code,
                name: `Area ${code}`,
                areaType: 'UA unchanged',
                displayGroup: 'Local authorities',
              })),
            );
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
              : detailFor(path.slice('/api/indicators/'.length)),
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
  it('loads exactly the areas represented by the selection, plus England, at the cap', async () => {
    const { client, get } = api();
    const codes = Array.from({ length: 21 }, (_, i) => `E${String(i).padStart(8, '0')}`);
    const params = new URLSearchParams([['is', '108'], ...codes.map((code) => ['as', code])]);
    const result = await loadIndicator(
      loaderArgs(client, {}, `http://localhost/indicators?${params}`),
    );
    expect(result.selection.areaCodes).toEqual(codes.slice(0, 19));
    expect(result.selectedAreas.map(({ code }) => code)).toEqual(codes.slice(0, 19));
    expect(result.areasLimited).toBe(true);
    const [path] = get.mock.calls.find(([path]) => String(path).includes('/data')) ?? [];
    expect(new URL(`http://localhost${path}`).searchParams.getAll('areaCode')).toEqual([
      ...codes.slice(0, 19),
      'E92000001',
    ]);
  });

  it('selects nothing when neither the route nor the query names an indicator', async () => {
    const { client, get } = api();

    const result = await loadIndicator(loaderArgs(client));

    expect(result.selected).toEqual([]);
    expect(result.selection.numbers).toEqual([]);
    // The indicator catalogue stays server-side, while the geography tree receives only
    // its bounded first-page previews.
    expect(get).not.toHaveBeenCalledWith('/api/indicators', expect.anything());
    const [previewPath] = get.mock.calls.find(([path]) => String(path).includes('limit=101')) ?? [];
    expect(
      new URL(`http://localhost${previewPath}`).searchParams.getAll('displayGroup'),
    ).toHaveLength(6);
  });

  it('answers a no-script find search with the server matches, trimmed and encoded', async () => {
    const { client, get } = api();

    const result = await loadIndicator(
      loaderArgs(client, {}, 'http://localhost/indicators?find=+diabetes+%26+obesity+'),
    );

    expect(get).toHaveBeenCalledWith(
      '/api/indicators?q=diabetes%20%26%20obesity&limit=20',
      expect.anything(),
    );
    expect(result.findSubject).toBe('diabetes & obesity');
    expect(result.findResults).toEqual([
      { slug: 'diabetes-qof-prevalence', number: 241, name: 'Diabetes: QOF prevalence' },
    ]);
  });

  it('skips the find search when the parameter is missing or blank', async () => {
    const { client, get } = api();

    const result = await loadIndicator(
      loaderArgs(client, {}, 'http://localhost/indicators?find=++'),
    );

    expect(result.findSubject).toBe('');
    expect(result.findResults).toEqual([]);
    expect(get.mock.calls.some(([path]) => String(path).includes('q='))).toBe(false);
  });

  it('treats the route param as a single selection', async () => {
    const { client, get } = api();

    const result = await loadIndicator(
      loaderArgs(client, { alias: 'indicator-108' }, 'http://localhost/indicators/indicator-108'),
    );

    expect(result.selection.numbers).toEqual([108]);
    expect(client.getOrRedirect).toHaveBeenCalledWith(
      '/api/indicators/indicator-108',
      expect.anything(),
    );
    expect(get).toHaveBeenCalledWith(
      '/api/indicators/indicator-108/data?areaCode=E92000001',
      expect.anything(),
    );
  });

  // A Fingertips-era link arrives on the number; the page lives at the canonical slug.
  it('redirects an alias that is not canonical, keeping the query string', async () => {
    const { client } = api();

    const thrown = await loadIndicator(
      loaderArgs(client, { alias: '108' }, 'http://localhost/indicators/108?as=E12000001'),
    ).then(
      () => undefined,
      (error: Response) => error,
    );

    expect(thrown?.status).toBe(301);
    expect(thrown?.headers.get('location')).toBe('/indicators/indicator-108?as=E12000001');
  });

  it('loads every indicator named in the query string', async () => {
    const { client, get } = api();

    const result = await loadIndicator(
      loaderArgs(client, {}, 'http://localhost/indicators?is=108&is=90366'),
    );

    expect(result.selection.numbers).toEqual([108, 90366]);
    expect(get).toHaveBeenCalledWith('/api/indicators/108', expect.anything());
    expect(get).toHaveBeenCalledWith('/api/indicators/90366', expect.anything());
  });

  it('lets a query selection replace the route param', async () => {
    const { client } = api();

    const result = await loadIndicator(
      loaderArgs(
        client,
        { alias: 'indicator-108' },
        'http://localhost/indicators/indicator-108?is=90366',
      ),
    );

    expect(result.selection.numbers).toEqual([90366]);
  });

  it('drops duplicate and malformed ids and caps the selection', async () => {
    const { client } = api();
    const many = Array.from({ length: 15 }, (_, i) => `is=${100 + i}`).join('&');

    const result = await loadIndicator(
      loaderArgs(client, {}, `http://localhost/indicators?is=108&is=108&is=abc&${many}`),
    );

    expect(result.selection.numbers).toHaveLength(10);
    expect(result.selection.numbers.filter((number) => number === 108)).toHaveLength(1);
    expect(result.indicatorsLimited).toBe(true);
  });

  it('asks for every selected area in one request per indicator', async () => {
    const { client, get } = api();

    await loadIndicator(
      loaderArgs(client, {}, 'http://localhost/indicators?is=108&as=E12000001&as=E12000002'),
    );

    // One call carrying both codes, not one call per code; England rides along last so
    // the benchmark columns always have its series.
    expect(get).toHaveBeenCalledWith(
      '/api/indicators/indicator-108/data?areaCode=E12000001&areaCode=E12000002&areaCode=E92000001',
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
      '/api/indicators/indicator-108/data?areaCode=E12000001&areaCode=E92000001',
    );
  });

  it('skips range and region requests when no benchmark option displays them', async () => {
    const { client, get } = api();

    await loadIndicator(
      loaderArgs(client, {}, 'http://localhost/indicators?is=108&as=E12000001&cmp-108=england'),
    );

    // A benchmark value column needs only the England series already loaded; the
    // expensive level range is fetched when the comparison range is switched on.
    expect(get.mock.calls.some(([path]) => String(path).includes('/range'))).toBe(false);
  });

  it('fetches the picked levels ranges when the england comparison range is shown', async () => {
    const { client, get } = api();

    await loadIndicator(
      loaderArgs(
        client,
        {},
        'http://localhost/indicators?is=108&as=E12000001&cmp-108=england&cr-108=yes',
      ),
    );

    const rangeCalls = get.mock.calls.filter(([path]) => String(path).includes('/range'));
    expect(rangeCalls).toHaveLength(1);
    expect(String(rangeCalls[0]?.[0])).toContain(
      `displayGroup=${encodeURIComponent('Local authorities')}`,
    );
  });

  it('fetches the statistical regions range and region data for a region benchmark', async () => {
    const get = vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/api/areas/parents')) {
        return Promise.resolve([
          { code: 'E06000052', parentCode: 'E12000009', parentName: 'South West' },
        ]);
      }
      if (path === '/api/areas/display-groups') {
        return Promise.resolve(['Local authorities', 'Statistical regions']);
      }
      if (path.startsWith('/api/areas/lookup')) {
        return Promise.resolve([
          {
            code: 'E06000052',
            name: 'Cornwall',
            areaType: 'UA unchanged',
            displayGroup: 'Local authorities',
          },
        ]);
      }
      if (path.includes('/range')) {
        return Promise.resolve({ periods: [] });
      }
      return Promise.resolve(
        path.includes('/data')
          ? [{ areaCode: '', areaName: '', observations: [] }]
          : detailFor(path.slice('/api/indicators/'.length)),
      );
    });
    const { client } = api(get);

    await loadIndicator(
      loaderArgs(
        client,
        {},
        'http://localhost/indicators?is=108&as=E06000052&cmp-108=region&cr-108=yes',
      ),
    );

    const parentsCalls = get.mock.calls.filter(([path]) =>
      String(path).startsWith('/api/areas/parents'),
    );
    expect(parentsCalls).toHaveLength(1);
    expect(String(parentsCalls[0]?.[0])).toBe(
      `/api/areas/parents?areaCode=E06000052&parentType=${encodeURIComponent('Regions (statistical)')}`,
    );
    const rangeCalls = get.mock.calls.filter(([path]) => String(path).includes('/range'));
    expect(rangeCalls).toHaveLength(1);
    expect(String(rangeCalls[0]?.[0])).toContain(
      `displayGroup=${encodeURIComponent('Statistical regions')}`,
    );
    expect(get.mock.calls.some(([path]) => String(path).includes('areaCode=E12000009'))).toBe(true);
  });

  it('fetches region data for a region benchmark even without its comparison range', async () => {
    const get = vi.fn().mockImplementation((path: string) => {
      if (path === '/api/areas/display-groups') return Promise.resolve(['Local authorities']);
      if (path.startsWith('/api/areas/parents')) {
        return Promise.resolve([
          { code: 'E06000052', parentCode: 'E12000009', parentName: 'South West' },
        ]);
      }
      if (path.startsWith('/api/areas/lookup')) {
        return Promise.resolve([{ code: 'E06000052', name: 'Cornwall', areaType: 'UA unchanged' }]);
      }
      return Promise.resolve(
        path.includes('/data')
          ? [{ areaCode: '', areaName: '', observations: [] }]
          : detailFor(path.slice('/api/indicators/'.length)),
      );
    });
    const { client } = api(get);

    await loadIndicator(
      loaderArgs(client, {}, 'http://localhost/indicators?is=108&as=E06000052&cmp-108=region'),
    );

    // The benchmark value column needs the region series; only the range stays unfetched.
    expect(get.mock.calls.some(([path]) => String(path).includes('areaCode=E12000009'))).toBe(true);
    expect(get.mock.calls.some(([path]) => String(path).includes('/range'))).toBe(false);
  });

  it('unions the england and compare-table region ranges in a mixed state', async () => {
    const { client, get } = api();

    await loadIndicator(
      loaderArgs(
        client,
        {},
        'http://localhost/indicators?is=108&as=E12000001&cmp-108=england&cr-108=yes&cmp-compare=region&cr-compare=yes',
      ),
    );

    const rangeCalls = get.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes('/range'));
    expect(rangeCalls).toHaveLength(2);
    expect(
      rangeCalls.some((path) => path.includes(encodeURIComponent('Statistical regions'))),
    ).toBe(true);
  });

  it('lets the client 404 through so the not-found boundary renders', async () => {
    const { client } = api();
    client.getOrRedirect = vi
      .fn()
      .mockRejectedValue(new Response('Not Found', { status: 404 })) as ApiClient['getOrRedirect'];

    await expect(
      loadIndicator(loaderArgs(client, { alias: 'no-such-indicator' })),
    ).rejects.toMatchObject({ status: 404 });
  });
});
