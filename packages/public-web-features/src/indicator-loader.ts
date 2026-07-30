import {
  areaListSchema,
  indicatorAreaDataSchema,
  indicatorDetailSchema,
  indicatorListResponseSchema,
} from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

export type {
  AreaSummary,
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
  IndicatorSummary,
} from '@fphd/public-api-features/contract';

export interface IndicatorSelection {
  areaType: string;
  areaCodes: string[];
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

  const fingertipsIds = selectedIndicatorIds(url, params.fingertipsId);

  const areaType = url.searchParams.get('ats') || DEFAULT_AREA_TYPE;
  const areaCodes = url.searchParams
    .getAll('as')
    .filter((code) => /^[A-Z0-9]+$/i.test(code))
    .slice(0, MAX_SELECTED_AREAS);
  const codesToLoad = areaCodes.length > 0 ? areaCodes : [DEFAULT_AREA_CODE];

  const api = context.get(apiContext);
  const [availableAreas, availableIndicators, selected] = await Promise.all([
    api.get(`/api/areas?area_type=${encodeURIComponent(areaType)}`, areaListSchema),
    api.get('/api/indicators', indicatorListResponseSchema),
    Promise.all(
      fingertipsIds.map(async (id) => {
        const [detail, areaData] = await Promise.all([
          api.get(apiPath`/api/indicators/${String(id)}`, indicatorDetailSchema),
          Promise.all(
            codesToLoad.map((code) =>
              api.get(
                `${apiPath`/api/indicators/${String(id)}/data`}?area_code=${encodeURIComponent(code)}`,
                indicatorAreaDataSchema,
              ),
            ),
          ),
        ]);
        return { detail, areaData };
      }),
    ),
  ]);

  return {
    selected,
    availableAreas,
    availableIndicators: availableIndicators.indicators,
    selection: { areaType, areaCodes, fingertipsIds } satisfies IndicatorSelection,
  };
}
