import {
  areaGroupListSchema,
  areaParentListSchema,
  indicatorAreaDataListSchema,
  indicatorAreaDataSchema,
  indicatorDetailSchema,
  indicatorListResponseSchema,
  indicatorRangeSchema,
} from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

import {
  ALL_DISPLAY_AREA_TYPES,
  cleanAreaName,
  DISPLAY_LEVEL_NAMES,
  displayLevelOf,
  levelAreaTypes,
} from './geography-display';

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
  areaType: string;
  areaCodes: string[];
  /** Whole geography levels selected as one ("Local authorities"), kept as a single
   *  chip and query value rather than hundreds of individual area codes. */
  areaLevels: string[];
  fingertipsIds: number[];
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

/** Which benchmark each selected area can be compared against. */
export interface BenchmarkGeography {
  /** Selected area code → its statistical region, where one exists. */
  regionByCode: Record<string, { code: string; name: string }>;
  /** Selected area code → its display level, for picking the England range. */
  levelByCode: Record<string, string>;
}

const DEFAULT_AREA_TYPE = 'England';
const DEFAULT_AREA_CODE = 'E92000001';

// Charts and tables with dozens of series are unreadable long before they are slow, so the
// selection is capped rather than the URL trusted.
const MAX_SELECTED_AREAS = 20;
const MAX_SELECTED_INDICATORS = 10;

function selectedIndicatorIds(url: URL, routeParam: string | undefined): number[] {
  const fromQuery = url.searchParams
    .getAll('is')
    .filter((value) => /^\d+$/.test(value))
    .map(Number);

  // The route param is the deep link into a single indicator; a query selection replaces
  // it, so a link out of the page never silently re-adds where the user arrived from.
  // Callers validate the param's shape before this point.
  const ids = fromQuery.length > 0 ? fromQuery : routeParam ? [Number(routeParam)] : [];

  return [...new Set(ids)].slice(0, MAX_SELECTED_INDICATORS);
}

/**
 * Kept free of any @fphd/ui import so it can be unit-tested without the jsdom/SSR
 * environment the GOV.UK component library needs. Selection state lives in the query
 * string (`is` = indicators, `ats` = area type, `as` = area codes, all repeatable) so the
 * page is a working form without client JavaScript and every view is a shareable URL.
 *
 * The client turns the API's 404 into a thrown 404 Response, so React Router renders the
 * nearest not-found boundary instead of the page component. It also encodes the path
 * segment — React Router decodes %2F inside a single dynamic segment, so an un-encoded id
 * of '../topics' would normalise the request onto a different API route entirely.
 */
export async function loadIndicator({ context, params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  if (params.fingertipsId !== undefined && !/^\d+$/.test(params.fingertipsId)) {
    // `indicators/:fingertipsId` matched but the segment is not a number, which the API
    // would answer with a 404 anyway. Failing here keeps the request off the API.
    throw new Response('Not Found', { status: 404 });
  }

  const areaType = url.searchParams.get('ats') || DEFAULT_AREA_TYPE;
  // De-duplicated: a hand-edited URL repeating a code would otherwise fetch it twice and
  // render it twice.
  const areaCodes = [
    ...new Set(url.searchParams.getAll('as').filter((code) => /^[A-Z0-9]+$/i.test(code))),
  ].slice(0, MAX_SELECTED_AREAS);
  const areaLevels = [
    ...new Set(url.searchParams.getAll('als').filter((l) => DISPLAY_LEVEL_NAMES.includes(l))),
  ];

  const api = context.get(apiContext);

  // A whole-level selection ("Local authorities") rides in the URL as its name; its
  // areas are resolved here, subject to the same cap as hand-picked codes.
  let levelCodes: string[] = [];
  if (areaLevels.length > 0) {
    const types = [...new Set(areaLevels.flatMap(levelAreaTypes))];
    const levelGroups = await api.get(
      `/api/areas?${types.map((name) => `area_type=${encodeURIComponent(name)}`).join('&')}`,
      areaGroupListSchema,
    );
    levelCodes = levelGroups.flatMap(({ areas }) => areas.map(({ code }) => code));
  }
  // England rides along last for the benchmark; the first entry stays the area the page describes.
  const pickedCodes = [...new Set([...areaCodes, ...levelCodes])]
    .filter((code) => code !== DEFAULT_AREA_CODE)
    .slice(0, MAX_SELECTED_AREAS - 1);
  const codesToLoad = [...pickedCodes, DEFAULT_AREA_CODE];

  // Both benchmarks need each picked area's display level and statistical region up front.
  const nonEnglandCodes = codesToLoad.filter((code) => code !== DEFAULT_AREA_CODE);

  const [areaGroups, areaParents] = await Promise.all([
    // The tree always offers every level; missing data never hides a geography.
    api.get(
      `/api/areas?${ALL_DISPLAY_AREA_TYPES.map(
        (name) => `area_type=${encodeURIComponent(name)}`,
      ).join('&')}`,
      areaGroupListSchema,
    ),
    nonEnglandCodes.length > 0
      ? api.get(
          `/api/areas/parents?${nonEnglandCodes
            .map((code) => `area_code=${encodeURIComponent(code)}`)
            .join('&')}&parent_type=${encodeURIComponent('Regions (statistical)')}`,
          areaParentListSchema,
        )
      : Promise.resolve([]),
  ]);

  const levelByCode: Record<string, string> = {};
  for (const { areaType: typeName, areas } of areaGroups) {
    const level = displayLevelOf(typeName);
    if (!level) {
      continue;
    }
    for (const { code } of areas) {
      if (nonEnglandCodes.includes(code)) {
        levelByCode[code] = level;
      }
    }
  }
  const regionByCode: Record<string, { code: string; name: string }> = {};
  for (const { code, parentCode, parentName } of areaParents) {
    regionByCode[code] = { code: parentCode, name: cleanAreaName(parentName) };
  }

  const rangeLevels = [...new Set(Object.values(levelByCode))];
  if (Object.keys(regionByCode).length > 0 && !rangeLevels.includes('Statistical regions')) {
    rangeLevels.push('Statistical regions');
  }
  const regionCodes = [...new Set(Object.values(regionByCode).map(({ code }) => code))];

  const fingertipsIds = selectedIndicatorIds(url, params.fingertipsId);
  // The no-script search: the quicksearch form round-trips `find` and the card lists
  // the server's matches as add links.
  const findSubject = url.searchParams.get('find')?.trim() ?? '';
  const findResults = findSubject
    ? (
        await api.get(
          `/api/indicators?q=${encodeURIComponent(findSubject)}&limit=20`,
          indicatorListResponseSchema,
        )
      ).indicators
    : [];
  const selected = await Promise.all(
    fingertipsIds.map(async (id) => {
      const dataFor = (codes: string[]) =>
        api.get(
          `${apiPath`/api/indicators/${String(id)}/data`}?${codes
            .map((code) => `area_code=${encodeURIComponent(code)}`)
            .join('&')}`,
          codes.length === 1
            ? indicatorAreaDataSchema.transform((one) => [one])
            : indicatorAreaDataListSchema,
        );
      const [detail, areaData, regionData, rangeEntries] = await Promise.all([
        api.get(apiPath`/api/indicators/${String(id)}`, indicatorDetailSchema),
        // One request per indicator carrying every area, rather than one per pair: a
        // page comparing ten indicators across twenty areas would otherwise fire 200.
        dataFor(codesToLoad),
        regionCodes.length > 0 ? dataFor(regionCodes) : Promise.resolve([]),
        Promise.all(
          rangeLevels.map(async (level) => {
            const range = await api.get(
              `${apiPath`/api/indicators/${String(id)}/range`}?${levelAreaTypes(level)
                .map((name) => `area_type=${encodeURIComponent(name)}`)
                .join('&')}`,
              indicatorRangeSchema,
            );
            return [level, range.periods] as const;
          }),
        ),
      ]);
      return {
        detail,
        // Pholio area names carry their level as a suffix; the tables show the bare name.
        areaData: areaData.map((data) => ({ ...data, areaName: cleanAreaName(data.areaName) })),
        regionData: regionData.map((data) => ({
          ...data,
          areaName: cleanAreaName(data.areaName),
        })),
        ranges: Object.fromEntries(rangeEntries),
      };
    }),
  );

  return {
    selected,
    areaGroups,
    benchmarkGeography: { regionByCode, levelByCode } satisfies BenchmarkGeography,
    findSubject,
    findResults,
    selection: { areaType, areaCodes, areaLevels, fingertipsIds } satisfies IndicatorSelection,
  };
}
