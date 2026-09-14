import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadGeography } from './geography-loader';

function loaderArgs(get: ReturnType<typeof vi.fn>, url: string): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);
  return { context, params: {}, request: new Request(url) } as unknown as LoaderFunctionArgs;
}

describe('geography loader', () => {
  it('answers a level with its areas by display group', async () => {
    const get = vi.fn().mockResolvedValue([
      {
        displayGroup: 'Statistical regions',
        areas: [
          { code: 'E12000001', name: 'North East' },
          { code: 'E12000009', name: 'South West' },
        ],
      },
    ]);

    const response = await loadGeography(
      loaderArgs(get, 'http://localhost/geographies?level=Statistical%20regions'),
    );

    expect(get).toHaveBeenCalledWith(
      '/api/areas?displayGroup=Statistical%20regions&limit=101',
      expect.anything(),
    );
    expect(await response.json()).toEqual({
      areas: [
        { code: 'E12000001', name: 'North East' },
        { code: 'E12000009', name: 'South West' },
      ],
    });
  });

  it('answers an unknown level with no areas', async () => {
    const get = vi.fn().mockResolvedValue([{ displayGroup: 'Nope', areas: [] }]);

    const response = await loadGeography(
      loaderArgs(get, 'http://localhost/geographies?level=Nope'),
    );

    expect(await response.json()).toEqual({ areas: [] });
  });

  it('groups search matches by their display group, dropping ungrouped areas', async () => {
    const get = vi.fn().mockResolvedValue([
      {
        code: 'E06000052',
        name: 'Cornwall',
        areaType: 'UA unchanged',
        displayGroup: 'Local authorities',
      },
      {
        code: 'E12000009',
        name: 'South West',
        areaType: 'Regions (statistical)',
        displayGroup: 'Statistical regions',
      },
      { code: 'E92000001', name: 'England', areaType: 'England', displayGroup: null },
    ]);

    const response = await loadGeography(loaderArgs(get, 'http://localhost/geographies?q=west'));

    expect(get).toHaveBeenCalledWith('/api/areas/search?q=west&limit=50', expect.anything());
    expect(await response.json()).toEqual({
      groups: [
        { name: 'Local authorities', areas: [{ code: 'E06000052', name: 'Cornwall' }] },
        { name: 'Statistical regions', areas: [{ code: 'E12000009', name: 'South West' }] },
      ],
    });
  });

  it('answers an overlong level with no areas and no api call', async () => {
    const get = vi.fn();

    const response = await loadGeography(
      loaderArgs(get, `http://localhost/geographies?level=${'a'.repeat(101)}`),
    );

    expect(await response.json()).toEqual({ areas: [] });
    expect(get).not.toHaveBeenCalled();
  });

  it('answers an empty query with no groups and no api call', async () => {
    const get = vi.fn();

    const response = await loadGeography(loaderArgs(get, 'http://localhost/geographies?q=++'));

    expect(await response.json()).toEqual({ groups: [] });
    expect(get).not.toHaveBeenCalled();
  });

  it('bounds geography searches to the same length as the page form', async () => {
    const get = vi.fn().mockResolvedValue([]);
    await loadGeography(loaderArgs(get, `http://localhost/geographies?q=++${'a'.repeat(101)}++`));
    expect(get).toHaveBeenCalledWith(
      `/api/areas/search?q=${'a'.repeat(100)}&limit=50`,
      expect.anything(),
    );
  });

  it('propagates failures so the picker can offer a retry', async () => {
    const failure = new Response(null, { status: 502 });
    const get = vi.fn().mockRejectedValue(failure);
    await expect(
      loadGeography(loaderArgs(get, 'http://localhost/geographies?q=Cornwall')),
    ).rejects.toBe(failure);
  });
});
