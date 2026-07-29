import {
  areaListSchema,
  indicatorAreaDataSchema,
  indicatorDetailSchema,
} from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

export type {
  AreaSummary,
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
} from '@fphd/public-api-features/contract';

export interface IndicatorSelection {
  areaType: string;
  areaCodes: string[];
}

const DEFAULT_AREA_TYPE = 'England';
const DEFAULT_AREA_CODE = 'E92000001';

// A chart or table with dozens of series is unreadable long before it is slow, so the
// selection is capped rather than the URL trusted.
const MAX_SELECTED_AREAS = 20;

/**
 * Kept free of any @fphd/ui import so it can be unit-tested without the jsdom/SSR
 * environment the GOV.UK component library needs. Selection state lives in the query
 * string (`ats` = area type, `as` = area codes, repeatable) so the page is a working
 * form without client JavaScript and every view is a shareable URL.
 */
export async function loadIndicator({ context, params, request }: LoaderFunctionArgs) {
  const { fingertipsId } = params;

  if (!fingertipsId) {
    // `indicators/:fingertipsId` cannot match without a segment, so reaching here means the
    // route table and this loader have drifted apart — a wiring bug, not a request the user
    // can make.
    throw new Error('loadIndicator expects a fingertipsId param; check the route that renders it');
  }

  const url = new URL(request.url);
  const areaType = url.searchParams.get('ats') || DEFAULT_AREA_TYPE;
  const areaCodes = url.searchParams
    .getAll('as')
    .filter((code) => /^[A-Z0-9]+$/i.test(code))
    .slice(0, MAX_SELECTED_AREAS);
  const codesToLoad = areaCodes.length > 0 ? areaCodes : [DEFAULT_AREA_CODE];

  const api = context.get(apiContext);
  const [indicator, availableAreas, areaData] = await Promise.all([
    api.get(apiPath`/api/indicators/${fingertipsId}`, indicatorDetailSchema),
    api.get(`/api/areas?area_type=${encodeURIComponent(areaType)}`, areaListSchema),
    Promise.all(
      codesToLoad.map((code) =>
        api.get(
          `${apiPath`/api/indicators/${fingertipsId}/data`}?area_code=${encodeURIComponent(code)}`,
          indicatorAreaDataSchema,
        ),
      ),
    ),
  ]);

  return {
    indicator,
    availableAreas,
    areaData,
    selection: { areaType, areaCodes } satisfies IndicatorSelection,
  };
}
