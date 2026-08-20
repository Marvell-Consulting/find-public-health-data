import {
  areaGroupListSchema,
  indicatorAreaDataListSchema,
  indicatorAreaDataSchema,
  indicatorDetailSchema,
  indicatorListResponseSchema,
} from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

import { cleanAreaName, DISPLAY_LEVEL_NAMES, levelAreaTypes } from './geography-display';

export type {
  AreaGroup,
  AreaSummary,
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
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
  const codesToLoad =
    areaCodes.length > 0 || levelCodes.length > 0
      ? [...new Set([...areaCodes, ...levelCodes])].slice(0, MAX_SELECTED_AREAS)
      : [DEFAULT_AREA_CODE];

  const fingertipsIds = selectedIndicatorIds(url, params.fingertipsId);
  // The home page's search box lands here with only a subject: matches are offered as
  // results to pick from, never selected on the user's behalf. The API does the matching —
  // the full catalogue never travels with the page.
  const searchSubject = url.searchParams.get('searchSubject')?.trim() ?? '';
  const searchResults =
    fingertipsIds.length === 0 && searchSubject
      ? (
          await api.get(
            `/api/indicators?q=${encodeURIComponent(searchSubject)}&limit=100`,
            indicatorListResponseSchema,
          )
        ).indicators
      : [];

  const selected = await Promise.all(
    fingertipsIds.map(async (id) => {
      const [detail, areaData] = await Promise.all([
        api.get(apiPath`/api/indicators/${String(id)}`, indicatorDetailSchema),
        // One request per indicator carrying every area, rather than one per pair: a
        // page comparing ten indicators across twenty areas would otherwise fire 200.
        api.get(
          `${apiPath`/api/indicators/${String(id)}/data`}?${codesToLoad
            .map((code) => `area_code=${encodeURIComponent(code)}`)
            .join('&')}`,
          codesToLoad.length === 1
            ? indicatorAreaDataSchema.transform((one) => [one])
            : indicatorAreaDataListSchema,
        ),
      ]);
      return {
        detail,
        // Pholio area names carry their level as a suffix; the tables show the bare name.
        areaData: areaData.map((data) => ({ ...data, areaName: cleanAreaName(data.areaName) })),
      };
    }),
  );

  // Offer every area type the selection shares, so the tree can list them all as groups.
  const areaTypeNames =
    selected.length === 0
      ? [DEFAULT_AREA_TYPE]
      : selected
          .map(({ detail }) => detail.areaTypes.map(({ name }) => name))
          .reduce((shared, names) => shared.filter((name) => names.includes(name)));
  const areaGroups = await api.get(
    `/api/areas?${areaTypeNames.map((name) => `area_type=${encodeURIComponent(name)}`).join('&')}`,
    areaGroupListSchema,
  );

  return {
    selected,
    areaGroups,
    searchResults,
    searchSubject,
    selection: { areaType, areaCodes, areaLevels, fingertipsIds } satisfies IndicatorSelection,
  };
}
