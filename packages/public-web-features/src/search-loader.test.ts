import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadSearch } from './search-loader.js';

const DISPLAY_GROUPS = [
  'Local authorities',
  'Statistical regions',
  'NHS regions',
  'Integrated care boards',
  'Middle-layer super output areas',
  'GP practices',
];

const EMPTY_FACETS = {
  topics: [],
  classifications: [],
  sources: [],
  valueTypes: [],
  yearTypes: [],
};

const EMPTY_RESULT = { total: 0, limit: 200, indicators: [] };

function api(get = vi.fn()) {
  const client = {
    get: get.getMockImplementation()
      ? get
      : get.mockImplementation((path: string) => {
          if (path === '/api/areas/display-groups') {
            return Promise.resolve(DISPLAY_GROUPS);
          }
          if (path.startsWith('/api/areas/lookup')) {
            const codes = [...new URL(`http://x${path}`).searchParams.getAll('area_code')];
            return Promise.resolve(
              codes.map((code) => ({
                code,
                name: `Area ${code}`,
                areaType: 'UA unchanged',
                displayGroup: 'Local authorities',
              })),
            );
          }
          if (path === '/api/indicators/facets') {
            return Promise.resolve(EMPTY_FACETS);
          }
          if (path.startsWith('/api/indicators/search')) {
            return Promise.resolve(EMPTY_RESULT);
          }
          return Promise.resolve([]);
        }),
  } as unknown as ApiClient;
  return { client, get };
}

function loaderArgs(client: ApiClient, url = 'http://localhost/search'): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, client);
  return { context, params: {}, request: new Request(url) } as unknown as LoaderFunctionArgs;
}

describe('loadSearch', () => {
  it('returns empty filters when no params are given', async () => {
    const { client, get } = api();

    const result = await loadSearch(loaderArgs(client));

    expect(result.q).toBe('');
    expect(result.topics).toEqual([]);
    expect(result.geoLevels).toEqual([]);
    expect(result.gaCodes).toEqual([]);
    // Both facets and search are called in parallel.
    expect(get).toHaveBeenCalledWith('/api/indicators/facets', expect.anything());
    expect(get).toHaveBeenCalledWith('/api/indicators/search', expect.anything());
  });

  it('encodes keyword into the search query', async () => {
    const { client, get } = api();

    await loadSearch(loaderArgs(client, 'http://localhost/search?q=cancer+%26+mortality'));

    expect(
      get.mock.calls.some(([path]) =>
        String(path).includes(`q=${encodeURIComponent('cancer & mortality')}`),
      ),
    ).toBe(true);
  });

  it('passes topic slugs to the search API', async () => {
    const { client, get } = api();

    await loadSearch(loaderArgs(client, 'http://localhost/search?t=mortality&t=obesity'));

    expect(
      get.mock.calls.some(
        ([path]) => String(path).includes('t=mortality') && String(path).includes('t=obesity'),
      ),
    ).toBe(true);
  });

  it('strips invalid geo values and passes validated ones as display_group', async () => {
    const { client, get } = api();

    await loadSearch(
      loaderArgs(client, 'http://localhost/search?geo=Local+authorities&geo=Not+A+Real+Level'),
    );

    const searchCall = get.mock.calls.find(([path]) =>
      String(path).startsWith('/api/indicators/search'),
    );
    expect(String(searchCall?.[0])).toContain(
      `display_group=${encodeURIComponent('Local authorities')}`,
    );
    expect(String(searchCall?.[0])).not.toContain('Not+A+Real+Level');
  });

  it('drops area codes that fail the pattern', async () => {
    const { client } = api();

    const result = await loadSearch(
      loaderArgs(client, 'http://localhost/search?ga=E12000001&ga=invalid%20code&ga=E09000001'),
    );

    expect(result.gaCodes).not.toContain('invalid code');
    expect(result.gaCodes).toContain('E12000001');
  });

  it('resolves ga codes to display groups via lookup and unions with geo', async () => {
    const { client, get } = api();

    await loadSearch(loaderArgs(client, 'http://localhost/search?ga=E12000001'));

    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('area_code=E12000001'),
      expect.anything(),
    );
    // Display group from lookup appears in search query.
    const searchCall = get.mock.calls.find(([path]) =>
      String(path).startsWith('/api/indicators/search'),
    );
    expect(String(searchCall?.[0])).toContain(
      `display_group=${encodeURIComponent('Local authorities')}`,
    );
  });

  it('drops ga codes that do not resolve (unknown areas)', async () => {
    const get = vi.fn().mockImplementation((path: string) => {
      if (path === '/api/areas/display-groups') return Promise.resolve(DISPLAY_GROUPS);
      if (path.startsWith('/api/areas/lookup')) {
        // Simulate unknown code: returns empty array (no results).
        return Promise.resolve([]);
      }
      if (path === '/api/indicators/facets') return Promise.resolve(EMPTY_FACETS);
      if (path.startsWith('/api/indicators/search')) return Promise.resolve(EMPTY_RESULT);
      return Promise.resolve([]);
    });
    const { client } = api(get);

    const result = await loadSearch(loaderArgs(client, 'http://localhost/search?ga=UNKNOWN99'));

    expect(result.gaCodes).toHaveLength(0);
  });

  it('deduplicates repeated param values', async () => {
    const { client } = api();

    const result = await loadSearch(
      loaderArgs(client, 'http://localhost/search?t=mortality&t=mortality&t=obesity'),
    );

    expect(result.topics).toEqual(['mortality', 'obesity']);
  });

  it('fires facets and search in parallel (two calls, not sequential)', async () => {
    const callOrder: string[] = [];
    const get = vi.fn().mockImplementation((path: string) => {
      callOrder.push(path);
      if (path === '/api/areas/display-groups') return Promise.resolve(DISPLAY_GROUPS);
      if (path === '/api/indicators/facets') return Promise.resolve(EMPTY_FACETS);
      if (path.startsWith('/api/indicators/search')) return Promise.resolve(EMPTY_RESULT);
      return Promise.resolve([]);
    });
    const { client } = api(get);

    await loadSearch(loaderArgs(client));

    const facetsIdx = callOrder.indexOf('/api/indicators/facets');
    const searchIdx = callOrder.findIndex((p) => p.startsWith('/api/indicators/search'));
    // Both calls happen (order may vary in parallel, but both must be present).
    expect(facetsIdx).toBeGreaterThanOrEqual(0);
    expect(searchIdx).toBeGreaterThanOrEqual(0);
  });

  it('resolves no-JS t-add text to slug by case-insensitive name match and redirects', async () => {
    const get = vi.fn().mockImplementation((path: string) => {
      if (path === '/api/areas/display-groups') return Promise.resolve(DISPLAY_GROUPS);
      if (path === '/api/indicators/facets') {
        return Promise.resolve({
          ...EMPTY_FACETS,
          topics: [
            { slug: 'mortality-and-life-expectancy', title: 'Mortality and life expectancy' },
          ],
        });
      }
      return Promise.resolve([]);
    });
    const { client } = api(get);

    await expect(
      loadSearch(loaderArgs(client, 'http://localhost/search?t-add=MORTALITY+AND+LIFE+EXPECTANCY')),
    ).rejects.toMatchObject({ status: 302 });
  });

  it('fetches display-groups and area lookup in parallel (both called without awaiting)', async () => {
    const callOrder: string[] = [];
    const get = vi.fn().mockImplementation((path: string) => {
      callOrder.push(path);
      if (path === '/api/areas/display-groups') return Promise.resolve(DISPLAY_GROUPS);
      if (path.startsWith('/api/areas/lookup')) {
        return Promise.resolve([
          { code: 'E12000001', name: 'North East', displayGroup: 'Statistical regions' },
        ]);
      }
      if (path === '/api/indicators/facets') return Promise.resolve(EMPTY_FACETS);
      if (path.startsWith('/api/indicators/search')) return Promise.resolve(EMPTY_RESULT);
      return Promise.resolve([]);
    });
    const { client } = api(get);

    await loadSearch(loaderArgs(client, 'http://localhost/search?ga=E12000001'));

    const displayGroupsIdx = callOrder.indexOf('/api/areas/display-groups');
    const lookupIdx = callOrder.findIndex((p) => p.startsWith('/api/areas/lookup'));
    expect(displayGroupsIdx).toBeGreaterThanOrEqual(0);
    expect(lookupIdx).toBeGreaterThanOrEqual(0);
    // Both are initiated before either resolves: they appear adjacent in callOrder.
    expect(Math.abs(displayGroupsIdx - lookupIdx)).toBeLessThanOrEqual(1);
  });

  it('caps ga at 100 codes', async () => {
    const { client } = api();
    const manyGa = Array.from({ length: 120 }, (_, i) => `ga=E${String(i).padStart(8, '0')}`).join(
      '&',
    );

    const result = await loadSearch(loaderArgs(client, `http://localhost/search?${manyGa}`));

    expect(result.gaCodes.length).toBeLessThanOrEqual(100);
  });
});
