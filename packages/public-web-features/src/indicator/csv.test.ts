import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { loadIndicatorCsv } from './csv';

const detail = {
  fingertipsId: 108,
  name: 'Mortality, "all causes"',
  unit: { name: 'per 100,000', label: 'per 100,000' },
  yearType: 'Calendar',
};

function observation(overrides = {}) {
  return {
    fromDate: '2023-01-01',
    toDate: '2023-12-31',
    value: 341.1,
    lowerCi95: 339,
    upperCi95: 343.2,
    lowerCi998: null,
    upperCi998: null,
    count: 130000,
    denominator: null,
    notes: [],
    dimensions: [],
    ...overrides,
  };
}

function args(get: ReturnType<typeof vi.fn>, url: string, fingertipsId = '108') {
  const context = new RouterContextProvider();
  context.set(apiContext, { get } as unknown as ApiClient);
  return {
    context,
    params: { fingertipsId },
    request: new Request(url),
  } as unknown as LoaderFunctionArgs;
}

function api(areaData: unknown) {
  return vi.fn().mockImplementation((path: string) => {
    if (path.includes('/data')) {
      return Promise.resolve(areaData);
    }
    return Promise.resolve(detail);
  });
}

describe('loadIndicatorCsv', () => {
  it('serves the trend table as an attachment, quoting fields that need it', async () => {
    const get = api([
      { areaCode: 'E92000001', areaName: 'England', observations: [observation()] },
    ]);

    const response = await loadIndicatorCsv(
      args(get, 'http://localhost/indicators/108/table.csv'),
      'table',
    );

    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="108-table.csv"',
    );
    const body = await response.text();
    expect(body).toContain('Indicator,Area,Period,Count,"Calculated value (per 100,000)"');
    expect(body).toContain('"Mortality, ""all causes""",England,2023,130000,341.1');
  });

  it('loads the linked areas with England riding along and filters the trend by options', async () => {
    const get = api([
      {
        areaCode: 'E06000052',
        areaName: 'Cornwall',
        observations: [
          observation({
            value: 1,
            dimensions: [{ type: 'Sex', value: 'Male', dimensionClass: 'core', sortOrder: 1 }],
          }),
          observation({
            value: 2,
            dimensions: [{ type: 'Sex', value: 'Female', dimensionClass: 'core', sortOrder: 2 }],
          }),
        ],
      },
      { areaCode: 'E92000001', areaName: 'England', observations: [] },
    ]);

    const response = await loadIndicatorCsv(
      args(get, 'http://localhost/indicators/108/table.csv?as=E06000052&sex=Male'),
      'table',
    );

    expect(
      get.mock.calls.some(([path]) =>
        String(path).endsWith('/data?areaCode=E06000052&areaCode=E92000001'),
      ),
    ).toBe(true);
    const body = await response.text();
    expect(body).toContain(',1,');
    expect(body).not.toContain(',2,');
  });

  it('serves every observation with segments and notes in the all-data download', async () => {
    const get = api([
      {
        areaCode: 'E92000001',
        areaName: 'England',
        observations: [
          observation({
            dimensions: [{ type: 'Sex', value: 'Male', dimensionClass: 'core', sortOrder: 1 }],
            notes: [{ marker: 1, text: 'Provisional' }],
          }),
        ],
      },
    ]);

    const response = await loadIndicatorCsv(
      args(get, 'http://localhost/indicators/108/all-data.csv'),
      'all-data',
    );

    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="108-all-data.csv"',
    );
    const body = await response.text();
    expect(body).toContain('Segment');
    expect(body).toContain('Male');
    expect(body).toContain('Provisional');
  });

  it('ignores a sex the data does not publish rather than serving an empty table', async () => {
    const get = api([
      {
        areaCode: 'E92000001',
        areaName: 'England',
        observations: [
          observation({
            value: 7,
            dimensions: [{ type: 'Sex', value: 'Male', dimensionClass: 'core', sortOrder: 1 }],
          }),
        ],
      },
    ]);

    const response = await loadIndicatorCsv(
      args(get, 'http://localhost/indicators/108/table.csv?sex=Unpublished'),
      'table',
    );

    expect(await response.text()).toContain(',7,');
  });

  it('offers only the first area sexes, exactly as the page does', async () => {
    const get = api([
      { areaCode: 'E06000052', areaName: 'Cornwall', observations: [observation({ value: 9 })] },
      {
        areaCode: 'E92000001',
        areaName: 'England',
        observations: [
          observation({
            value: 5,
            dimensions: [{ type: 'Sex', value: 'Male', dimensionClass: 'core', sortOrder: 1 }],
          }),
        ],
      },
    ]);

    const response = await loadIndicatorCsv(
      args(get, 'http://localhost/indicators/108/table.csv?as=E06000052&sex=Male'),
      'table',
    );

    // Male exists only in England's series, so the filter is ignored, not applied.
    expect(await response.text()).toContain(',9,');
  });

  it('404s a non-numeric id without calling the api', async () => {
    const get = vi.fn();

    await expect(
      loadIndicatorCsv(args(get, 'http://localhost/indicators/x/table.csv', '../x'), 'table'),
    ).rejects.toMatchObject({ status: 404 });
    expect(get).not.toHaveBeenCalled();
  });
});
