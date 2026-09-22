import {
  areaLookupListSchema,
  areaParentListSchema,
  indicatorAreaDataListSchema,
  indicatorAreaDataSchema,
  indicatorDetailSchema,
  indicatorRangeSchema,
  pickAreaCodes,
} from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { type LoaderFunctionArgs, redirect } from 'react-router';
import { MAX_SELECTED_AREAS } from '../selection-limits.ts';
import {
  availableConfidenceLevels,
  availablePeriodTypes,
  type ConfidenceLevel,
  dimensionValues,
  filterObservations,
  type PeriodType,
} from './data.ts';
import { allDataCsv, trendCsv } from './download.ts';
import type { BenchmarkGeography, IndicatorAreaData } from './loader.ts';
import { indicatorCsvPath, isIndicatorSegment, redirectStatus } from './paths.ts';
import { trendTableModel } from './trend.ts';

const ENGLAND = 'E92000001';

/**
 * Serves the indicator page's downloads server-side, so they work without scripting.
 * The link carries the page's selected areas and trend-table options.
 */
export async function loadIndicatorCsv(
  { context, params, request }: LoaderFunctionArgs,
  kind: 'table' | 'all-data',
): Promise<Response> {
  const segment = params.slug;
  if (segment === undefined || !isIndicatorSegment(segment)) {
    throw new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  const pickedCodes = pickAreaCodes(url.searchParams.getAll('as'), Number.POSITIVE_INFINITY)
    .filter((code) => code !== ENGLAND)
    .slice(0, MAX_SELECTED_AREAS);
  const codesToLoad = [...pickedCodes, ENGLAND];
  const api = context.get(apiContext);
  const dataFor = (codes: string[]) =>
    api.get(
      `${apiPath`/api/indicators/${segment}/data`}?${codes
        .map((code) => `areaCode=${encodeURIComponent(code)}`)
        .join('&')}`,
      codes.length === 1
        ? indicatorAreaDataSchema.transform((one) => [one])
        : indicatorAreaDataListSchema,
    );
  const [detail, areaData] = await Promise.all([
    api.get(apiPath`/api/indicators/${segment}`, indicatorDetailSchema),
    dataFor(codesToLoad),
  ]);

  // The download shares the page's address, so it shares the page's one canonical form.
  if (detail.slug !== segment) {
    throw redirect(
      `${indicatorCsvPath(detail.slug, kind)}${url.search}`,
      redirectStatus(segment, detail.slug),
    );
  }

  const { shortId } = detail;

  let csv: string;
  if (kind === 'table') {
    // These validations exactly mirror the controls on the rendered page. A stale or
    // hand-edited URL therefore downloads the table the user can actually see.
    const requestedSex = url.searchParams.get(`sex-${shortId}`) ?? '';
    const sexes = dimensionValues(areaData[0]?.observations ?? [], 'Sex');
    const sex = sexes.includes(requestedSex) ? requestedSex : '';
    const shownObservations = (
      pickedCodes.length > 0 ? areaData.filter(({ areaCode }) => areaCode !== ENGLAND) : areaData
    ).flatMap(({ observations }) => observations);
    const requestedPeriod = url.searchParams.get(`pt-${shortId}`);
    const periodType: PeriodType = availablePeriodTypes(shownObservations).includes(
      requestedPeriod as '1-year' | '3-year',
    )
      ? (requestedPeriod as '1-year' | '3-year')
      : 'all';
    const requestedConfidence = url.searchParams.get(`ci-${shortId}`);
    const confidence: ConfidenceLevel = availableConfidenceLevels(shownObservations).includes(
      requestedConfidence as '95' | '99.8',
    )
      ? (requestedConfidence as '95' | '99.8')
      : 'none';
    const requestedBenchmark = url.searchParams.get(`cmp-${shortId}`);
    const benchmark =
      pickedCodes.length > 0 &&
      (requestedBenchmark === 'england' || requestedBenchmark === 'region')
        ? requestedBenchmark
        : 'none';
    const showRange = benchmark !== 'none' && url.searchParams.get(`cr-${shortId}`) === 'yes';

    const codeQuery = pickedCodes.map((code) => `areaCode=${encodeURIComponent(code)}`).join('&');
    const [lookedUp, parents] = await Promise.all([
      benchmark === 'england' && showRange
        ? api.get(`/api/areas/lookup?${codeQuery}`, areaLookupListSchema)
        : Promise.resolve([]),
      benchmark === 'region'
        ? api.get(
            `/api/areas/parents?${codeQuery}&parentType=${encodeURIComponent('Regions (statistical)')}`,
            areaParentListSchema,
          )
        : Promise.resolve([]),
    ]);
    const geography: BenchmarkGeography = { regionByCode: {}, levelByCode: {} };
    for (const { code, areaType, displayGroup } of lookedUp) {
      geography.levelByCode[code] = displayGroup ?? areaType;
    }
    for (const { code, parentCode, parentName } of parents) {
      geography.regionByCode[code] = { code: parentCode, name: parentName };
    }
    const regionCodes = [...new Set(parents.map(({ parentCode }) => parentCode))];
    const rangeLevels =
      benchmark === 'england'
        ? [...new Set(Object.values(geography.levelByCode))]
        : benchmark === 'region'
          ? ['Statistical regions']
          : [];
    const [regionData, rangeEntries] = await Promise.all([
      regionCodes.length > 0 ? dataFor(regionCodes) : Promise.resolve([] as IndicatorAreaData[]),
      showRange
        ? Promise.all(
            rangeLevels.map(async (level) => {
              const range = await api.get(
                `${apiPath`/api/indicators/${segment}/range`}?displayGroup=${encodeURIComponent(level)}`,
                indicatorRangeSchema,
              );
              return [level, range.periods] as const;
            }),
          )
        : Promise.resolve([]),
    ]);
    const narrow = (data: IndicatorAreaData) => ({
      ...data,
      observations: filterObservations(data.observations, { sex, periodType }),
    });
    csv = trendCsv(
      detail,
      trendTableModel({
        areaData: areaData.map(narrow),
        benchmark,
        confidence,
        geography,
        ranges: Object.fromEntries(rangeEntries),
        regionData: regionData.map(narrow),
      }),
      confidence,
      showRange,
    );
  } else {
    csv = allDataCsv(detail, areaData);
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${shortId}-${kind}.csv"`,
    },
  });
}
