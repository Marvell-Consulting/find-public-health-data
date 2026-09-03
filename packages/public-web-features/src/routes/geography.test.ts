import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loader } from './geography';

function loaderArgs(get: ReturnType<typeof vi.fn>, url: string): LoaderFunctionArgs {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);
  return { context, params: {}, request: new Request(url) } as unknown as LoaderFunctionArgs;
}

describe('geography resource route', () => {
  it('answers a level with its areas cleaned and sorted, asking for every backing type', async () => {
    const get = vi.fn().mockResolvedValue([
      {
        areaType: 'Regions (statistical)',
        areas: [
          { code: 'E12000009', name: 'South West region (statistical)' },
          { code: 'E12000001', name: 'North East region (statistical)' },
        ],
      },
    ]);

    const response = await loader(
      loaderArgs(get, 'http://localhost/geographies?level=Statistical%20regions'),
    );

    expect(get).toHaveBeenCalledWith(
      '/api/areas?area_type=Regions%20(statistical)',
      expect.anything(),
    );
    expect(await response.json()).toEqual({
      areas: [
        { code: 'E12000001', name: 'North East' },
        { code: 'E12000009', name: 'South West' },
      ],
    });
  });

  it('asks for all six local authority types behind that one level', async () => {
    const get = vi.fn().mockResolvedValue([]);

    await loader(loaderArgs(get, 'http://localhost/geographies?level=Local%20authorities'));

    const [path] = get.mock.calls[0] ?? [];
    expect(String(path).match(/area_type=/g)).toHaveLength(6);
  });

  it('answers an unknown level with no areas and no api call', async () => {
    const get = vi.fn();

    const response = await loader(loaderArgs(get, 'http://localhost/geographies?level=Nope'));

    expect(await response.json()).toEqual({ areas: [] });
    expect(get).not.toHaveBeenCalled();
  });

  it('groups search matches by display level, dropping unmapped types', async () => {
    const get = vi.fn().mockResolvedValue([
      { code: 'E06000052', name: 'Cornwall', areaType: 'UA unchanged' },
      {
        code: 'E12000009',
        name: 'South West region (statistical)',
        areaType: 'Regions (statistical)',
      },
      { code: 'E92000001', name: 'England', areaType: 'England' },
    ]);

    const response = await loader(loaderArgs(get, 'http://localhost/geographies?q=west'));

    const [path] = get.mock.calls[0] ?? [];
    expect(String(path)).toContain('/api/areas/search?q=west&limit=50');
    expect(await response.json()).toEqual({
      groups: [
        { name: 'Local authorities', areas: [{ code: 'E06000052', name: 'Cornwall' }] },
        { name: 'Statistical regions', areas: [{ code: 'E12000009', name: 'South West' }] },
      ],
    });
  });

  it('answers an empty query with no groups and no api call', async () => {
    const get = vi.fn();

    const response = await loader(loaderArgs(get, 'http://localhost/geographies?q=++'));

    expect(await response.json()).toEqual({ groups: [] });
    expect(get).not.toHaveBeenCalled();
  });
});
