import {
  areaDisplayGroupListSchema,
  areaLookupListSchema,
  areaParentListSchema,
  displayGroupListSchema,
  indicatorAreaDataListSchema,
  indicatorAreaDataSchema,
  indicatorDetailSchema,
  indicatorListResponseSchema,
  indicatorRangeSchema,
} from '@fphd/public-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { type LoaderFunctionArgs, redirect } from 'react-router';
import { loadGeographyOptions } from '../geography/loader.js';
import { MAX_SELECTED_AREAS, MAX_SELECTED_INDICATORS } from '../selection-limits.js';

export type {
  AreaGroup,
  AreaSummary,
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
  IndicatorRangePeriod,
  IndicatorSummary,
} from '@fphd/public-api-features/contract';

export interface IndicatorSelection {
  areaCodes: string[];
  /** Whole geography levels selected as one ("Local authorities"), kept as a single
   *  chip and query value rather than hundreds of individual area codes. */
  areaLevels: string[];
  /** The selected indicators as their numbers, which is what `is` carries. */
  numbers: number[];
}

/** One selected indicator with the area data backing its charts. */
export interface SelectedIndicator {
  detail: import('@fphd/public-api-features/contract').IndicatorDetail;
  areaData: import('@fphd/public-api-features/contract').IndicatorAreaData[];
  /** The statistical regions the selected areas roll up to, for the region benchmark. */
  regionData?: import('@fphd/public-api-features/contract').IndicatorAreaData[];
  /** Per display level ('Local authorities', 'Statistical regions'…): min/max of the
   *  value across every area of that level, per period — the comparison range. */
  ranges?: Record<string, import('@fphd/public-api-features/contract').IndicatorRangePeriod[]>;
}

/** A picked area resolved to its display name and level. */
export interface SelectedArea {
  code: string;
  name: string;
  level: string;
}

/** Which benchmark each selected area can be compared against. */
export interface BenchmarkGeography {
  /** Selected area code → its statistical region, where one exists. */
  regionByCode: Record<string, { code: string; name: string }>;
  /** Selected area code → its display level, for picking the England range. */
  levelByCode: Record<string, string>;
}

const DEFAULT_AREA_CODE = 'E92000001';

// Charts and tables with dozens of series are unreadable long before they are slow, so the
// selection is capped rather than the URL trusted.
export { MAX_SELECTED_INDICATORS } from '../selection-limits.js';

/**
 * The query selection, as numbers: a slug is too long to compose several of, so `is` takes
 * digit strings only and anything else is dropped rather than answered with an error.
 */
function selectedNumbers(url: URL): string[] {
  return [...new Set(url.searchParams.getAll('is').filter((value) => /^\d+$/.test(value)))];
}

/** The API redirects within its own indicator collection, so the alias is its first segment. */
function canonicalAliasOf(location: string): string {
  const [, alias] = /^\/api\/indicators\/([^/?#]+)/.exec(location) ?? [];

  if (alias === undefined) {
    throw new Response('Bad Gateway', { status: 502 });
  }

  return decodeURIComponent(alias);
}

/**
 * The indicator a route's alias names. An indicator answers to its number and to every
 * slug it has been published under, but its page is served at one canonical address, so
 * the API answers the others with a redirect and the browser is sent there rather than the
 * page rendering the same content under a second URL.
 */
export async function loadIndicatorByAlias(
  api: ApiClient,
  alias: string,
  canonicalPath: (canonical: string) => string,
): Promise<import('@fphd/public-api-features/contract').IndicatorDetail> {
  const result = await api.getOrRedirect(apiPath`/api/indicators/${alias}`, indicatorDetailSchema);

  if (result.redirected) {
    throw redirect(canonicalPath(canonicalAliasOf(result.location)), 301);
  }

  return result.data;
}

/**
 * Kept free of any @fphd/ui import so it can be unit-tested without the jsdom/SSR
 * environment the GOV.UK component library needs. Selection state lives in the query
 * string (`is` = indicators, `ats` = area type, `as` = area codes, all repeatable) so the
 * page is a working form without client JavaScript and every view is a shareable URL.
 *
 * The client turns the API's 404 into a thrown 404 Response, so React Router renders the
 * nearest not-found boundary instead of the page component. It also encodes the path
 * segment — React Router decodes %2F inside a single dynamic segment, so an un-encoded
 * alias of '../topics' would normalise the request onto a different API route entirely.
 */
export async function loadIndicator({ context, params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // De-duplicated: a hand-edited URL repeating a code would otherwise fetch it twice and
  // render it twice.
  const requestedAreaCodes = [
    ...new Set(
      url.searchParams
        .getAll('as')
        .filter((code) => /^[A-Z0-9]+$/i.test(code) && code !== DEFAULT_AREA_CODE),
    ),
  ];
  const areaCodes = requestedAreaCodes.slice(0, MAX_SELECTED_AREAS);
  const requestedLevels = [
    ...new Set(url.searchParams.getAll('als').filter((l) => l !== '' && l.length <= 100)),
  ].slice(0, 10);

  const api = context.get(apiContext);

  const routeDetail =
    params.alias === undefined
      ? undefined
      : await loadIndicatorByAlias(
          api,
          params.alias,
          (canonical) => `/indicators/${encodeURIComponent(canonical)}${url.search}`,
        );

  // A whole-level selection ("Local authorities") rides in the URL as its name; its
  // areas are resolved here, subject to the same cap as hand-picked codes.
  let levelCodes: string[] = [];
  if (requestedLevels.length > 0) {
    const levelGroups = await api.get(
      `/api/areas?${requestedLevels
        .map((name) => `displayGroup=${encodeURIComponent(name)}`)
        .join('&')}`,
      areaDisplayGroupListSchema,
    );
    levelCodes = levelGroups.flatMap(({ areas }) => areas.map(({ code }) => code));
  }
  // England rides along last for the benchmark; the first entry stays the area the page describes.
  const pickedCodes = [...new Set([...areaCodes, ...levelCodes])]
    .filter((code) => code !== DEFAULT_AREA_CODE)
    .slice(0, MAX_SELECTED_AREAS);
  const codesToLoad = [...pickedCodes, DEFAULT_AREA_CODE];
  const areasLimited =
    new Set([...requestedAreaCodes, ...levelCodes].filter((code) => code !== DEFAULT_AREA_CODE))
      .size > MAX_SELECTED_AREAS;

  // Both benchmarks need each picked area's display level and statistical region up front.
  const nonEnglandCodes = codesToLoad.filter((code) => code !== DEFAULT_AREA_CODE);

  // Only the picked areas resolve to names and levels — the tree fetches its own
  // catalogue on demand, keeping thousands of areas out of the page payload.
  const codeQuery = nonEnglandCodes.map((code) => `areaCode=${encodeURIComponent(code)}`).join('&');
  const [lookedUp, areaParents, displayGroups] = await Promise.all([
    nonEnglandCodes.length > 0
      ? api.get(`/api/areas/lookup?${codeQuery}`, areaLookupListSchema)
      : Promise.resolve([]),
    nonEnglandCodes.length > 0
      ? api.get(
          `/api/areas/parents?${codeQuery}&parentType=${encodeURIComponent('Regions (statistical)')}`,
          areaParentListSchema,
        )
      : Promise.resolve([]),
    // The user-facing levels live on area_type now; the list validates `als` values after
    // the fact (level expansion tolerates unknown groups) and feeds the tree.
    api.get('/api/areas/display-groups', displayGroupListSchema),
  ]);
  const areaLevels = requestedLevels.filter((level) => displayGroups.includes(level));
  const geographyOptions = await loadGeographyOptions(api, url.searchParams, displayGroups);

  const selectedAreas = lookedUp.map(({ code, name, areaType: typeName, displayGroup }) => ({
    code,
    name,
    level: displayGroup ?? typeName,
  }));
  const levelByCode: Record<string, string> = {};
  for (const { code, level } of selectedAreas) {
    levelByCode[code] = level;
  }
  const regionByCode: Record<string, { code: string; name: string }> = {};
  for (const { code, parentCode, parentName } of areaParents) {
    regionByCode[code] = { code: parentCode, name: parentName };
  }

  const pickedLevels = [...new Set(Object.values(levelByCode))];
  const regionCodes = [...new Set(Object.values(regionByCode).map(({ code }) => code))];

  // Benchmark data is expensive (a range query aggregates every observation of a level),
  // so it is fetched only for indicators whose cmp/cr options actually display it.
  const comparisonFor = (id: number) => {
    const choices = [
      url.searchParams.get(`cmp-${id}`) ?? 'none',
      url.searchParams.get('cmp-compare') ?? 'none',
    ];
    const ranges = [
      url.searchParams.get(`cr-${id}`) === 'yes',
      url.searchParams.get('cr-compare') === 'yes',
    ];
    const rangeLevels = new Set<string>();
    choices.forEach((choice, index) => {
      if (!ranges[index]) {
        return;
      }
      if (choice === 'england') {
        for (const level of pickedLevels) {
          rangeLevels.add(level);
        }
      }
      if (choice === 'region') {
        rangeLevels.add('Statistical regions');
      }
    });
    return { region: choices.includes('region'), rangeLevels: [...rangeLevels] };
  };

  // A query selection replaces the route's indicator, so a link out of the page never
  // silently re-adds where the user arrived from.
  const requestedNumbers = selectedNumbers(url);
  const details =
    requestedNumbers.length > 0
      ? await Promise.all(
          requestedNumbers
            .slice(0, MAX_SELECTED_INDICATORS)
            .map((number) => api.get(apiPath`/api/indicators/${number}`, indicatorDetailSchema)),
        )
      : routeDetail
        ? [routeDetail]
        : [];
  // `find` is the quicksearch form's no-script round trip; matches render as add links.
  const findSubject = url.searchParams.get('find')?.trim().slice(0, 200) ?? '';
  const findResults = findSubject
    ? (
        await api.get(
          `/api/indicators?q=${encodeURIComponent(findSubject)}&limit=20`,
          indicatorListResponseSchema,
        )
      ).indicators
    : [];
  const selected = await Promise.all(
    details.map(async (detail) => {
      const dataFor = (codes: string[]) =>
        api.get(
          `${apiPath`/api/indicators/${detail.slug}/data`}?${codes
            .map((code) => `areaCode=${encodeURIComponent(code)}`)
            .join('&')}`,
          codes.length === 1
            ? indicatorAreaDataSchema.transform((one) => [one])
            : indicatorAreaDataListSchema,
        );
      const comparison = comparisonFor(detail.number);
      const [areaData, regionData, rangeEntries] = await Promise.all([
        // One request per indicator carrying every area, rather than one per pair: a
        // page comparing ten indicators across twenty areas would otherwise fire 200.
        dataFor(codesToLoad),
        comparison.region && regionCodes.length > 0 ? dataFor(regionCodes) : Promise.resolve([]),
        Promise.all(
          comparison.rangeLevels.map(async (level) => {
            const range = await api.get(
              `${apiPath`/api/indicators/${detail.slug}/range`}?displayGroup=${encodeURIComponent(level)}`,
              indicatorRangeSchema,
            );
            return [level, range.periods] as const;
          }),
        ),
      ]);
      return {
        detail,
        areaData,
        regionData,
        ranges: Object.fromEntries(rangeEntries),
      };
    }),
  );

  return {
    selected,
    selectedAreas,
    displayGroups,
    benchmarkGeography: { regionByCode, levelByCode } satisfies BenchmarkGeography,
    findSubject,
    findResults,
    geographyOptions,
    areasLimited,
    indicatorsLimited: requestedNumbers.length > MAX_SELECTED_INDICATORS,
    selection: {
      areaCodes,
      areaLevels,
      numbers: details.map(({ number }) => number),
    } satisfies IndicatorSelection,
  };
}
