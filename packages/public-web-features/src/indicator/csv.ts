import {
  indicatorAreaDataListSchema,
  indicatorAreaDataSchema,
  indicatorDetailSchema,
} from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

import { dimensionValues, filterObservations, type PeriodType } from './data';
import { allDataCsv, trendCsv } from './download';

const ENGLAND = 'E92000001';
const MAX_AREAS = 20;

/**
 * Serves the indicator page's downloads server-side, so they work without scripting.
 * The link carries the page's state: `as` area codes, and for the trend table the
 * `sex` and `pt` options it is filtered by.
 */
export async function loadIndicatorCsv(
  { context, params, request }: LoaderFunctionArgs,
  kind: 'table' | 'all-data',
): Promise<Response> {
  const { fingertipsId } = params;
  if (fingertipsId === undefined || !/^\d+$/.test(fingertipsId)) {
    throw new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  const codes = [
    ...new Set(url.searchParams.getAll('as').filter((code) => /^[A-Z0-9]+$/i.test(code))),
  ]
    .filter((code) => code !== ENGLAND)
    .slice(0, MAX_AREAS - 1);
  const codesToLoad = [...codes, ENGLAND];

  const api = context.get(apiContext);
  const [detail, areaData] = await Promise.all([
    api.get(apiPath`/api/indicators/${fingertipsId}`, indicatorDetailSchema),
    api.get(
      `${apiPath`/api/indicators/${fingertipsId}/data`}?${codesToLoad
        .map((code) => `area_code=${encodeURIComponent(code)}`)
        .join('&')}`,
      codesToLoad.length === 1
        ? indicatorAreaDataSchema.transform((one) => [one])
        : indicatorAreaDataListSchema,
    ),
  ]);

  let csv: string;
  if (kind === 'table') {
    // Sex options mirror the page's: offered from the first area's series, and a value
    // it does not publish falls back to unfiltered.
    const requestedSex = url.searchParams.get('sex') ?? '';
    const sexes = dimensionValues(areaData[0]?.observations ?? [], 'Sex');
    const sex = sexes.includes(requestedSex) ? requestedSex : '';
    const pt = url.searchParams.get('pt');
    const periodType: PeriodType = pt === '1-year' || pt === '3-year' ? pt : 'all';
    csv = trendCsv(
      detail,
      areaData.map((data) => ({
        ...data,
        observations: filterObservations(data.observations, { sex, periodType }),
      })),
    );
  } else {
    csv = allDataCsv(detail, areaData);
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fingertipsId}-${kind}.csv"`,
    },
  });
}
