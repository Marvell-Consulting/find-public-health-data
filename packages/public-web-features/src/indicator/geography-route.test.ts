import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loader } from './geography-route';

function loaderArgs(get: ReturnType<typeof vi.fn>, url: string): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);
  return { context, params: {}, request: new Request(url) } as unknown as LoaderFunctionArgs;
}

describe('geography resource route', () => {
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

    const response = await loader(
      loaderArgs(get, 'http://localhost/geographies?level=Statistical%20regions'),
    );

    expect(get).toHaveBeenCalledWith(
      '/api/areas?display_group=Statistical%20regions',
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

    const response = await loader(loaderArgs(get, 'http://localhost/geographies?level=Nope'));

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

    const response = await loader(loaderArgs(get, 'http://localhost/geographies?q=west'));

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

    const response = await loader(
      loaderArgs(get, `http://localhost/geographies?level=${'a'.repeat(101)}`),
    );

    expect(await response.json()).toEqual({ areas: [] });
    expect(get).not.toHaveBeenCalled();
  });

  it('answers an empty query with no groups and no api call', async () => {
    const get = vi.fn();

    const response = await loader(loaderArgs(get, 'http://localhost/geographies?q=++'));

    expect(await response.json()).toEqual({ groups: [] });
    expect(get).not.toHaveBeenCalled();
  });
});
