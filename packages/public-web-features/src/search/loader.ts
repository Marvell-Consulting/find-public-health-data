import {
  type AreaLookup,
  areaLookupListSchema,
  displayGroupListSchema,
  indicatorFacetsSchema,
  indicatorSearchResultSchema,
} from '@fphd/public-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { loadGeographyOptions } from '../geography/loader.js';
import { MAX_SELECTED_AREAS } from '../selection-limits.js';
import { DIMENSIONS } from './url.js';

export type {
  IndicatorFacets,
  IndicatorSearchResult,
  IndicatorSearchRow,
} from '@fphd/public-api-features/contract';

const AREA_CODE_RE = /^[A-Z0-9]+$/i;
const MAX_QUERY_LENGTH = 200;
const MAX_FILTER_LABEL_LENGTH = 500;

function pickStrings(params: URLSearchParams, key: string): string[] {
  const maxLength = key === 'src' ? MAX_FILTER_LABEL_LENGTH : 100;
  return [...new Set(params.getAll(key).filter((v) => v !== '' && v.length <= maxLength))].slice(
    0,
    100,
  );
}

function buildSearchQuery(
  query: string,
  params: URLSearchParams,
  displayGroups: string[],
  areaCodes: string[],
): string {
  const parts: string[] = [];

  if (query) {
    parts.push(`q=${encodeURIComponent(query)}`);
  }

  for (const dim of DIMENSIONS) {
    for (const val of pickStrings(params, dim.param)) {
      parts.push(`${dim.param}=${encodeURIComponent(val)}`);
    }
  }

  const validatedGeo = pickStrings(params, 'geo').filter((g) => displayGroups.includes(g));
  for (const g of validatedGeo) {
    parts.push(`display_group=${encodeURIComponent(g)}`);
  }
  for (const code of areaCodes) {
    parts.push(`area_code=${encodeURIComponent(code)}`);
  }

  return parts.join('&');
}

export async function loadSearch({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const api = context.get(apiContext);
  const query = params.get('q')?.trim().slice(0, MAX_QUERY_LENGTH) ?? '';

  const addParams = DIMENSIONS.map((d) => d.param);
  const hasAddControl = addParams.some((p) => params.has(`${p}-add`));

  const rawGa = pickStrings(params, 'ga')
    .filter((code) => AREA_CODE_RE.test(code))
    .slice(0, MAX_SELECTED_AREAS);

  const [displayGroups, lookedUp] = await Promise.all([
    api.get('/api/areas/display-groups', displayGroupListSchema),
    rawGa.length > 0
      ? api.get(
          `/api/areas/lookup?${rawGa.map((code) => `area_code=${encodeURIComponent(code)}`).join('&')}`,
          areaLookupListSchema,
        )
      : Promise.resolve<AreaLookup[]>([]),
  ]);

  const resolved = lookedUp.filter((a): a is AreaLookup & { displayGroup: string } =>
    Boolean(a.displayGroup),
  );
  const gaCodes = resolved.map((a) => a.code);
  const gaAreaNames: Record<string, string> = Object.fromEntries(
    resolved.map((a) => [a.code, a.name]),
  );

  if (hasAddControl) {
    const facets = await api.get('/api/indicators/facets', indicatorFacetsSchema);

    const next = new URLSearchParams(params);

    for (const dim of DIMENSIONS) {
      const addKey = `${dim.param}-add`;
      const typed = next.get(addKey)?.trim() ?? '';
      next.delete(addKey);
      if (!typed) continue;

      let match: string | undefined;
      if (dim.isTopicDimension) {
        match = facets.topics.find((t) => t.title.toLowerCase() === typed.toLowerCase())?.slug;
      } else if (dim.valueIsLabel) {
        const list =
          dim.stateKey === 'sources'
            ? facets.sources
            : dim.stateKey === 'valueTypes'
              ? facets.valueTypes
              : facets.yearTypes;
        match = list.find((s) => s.toLowerCase() === typed.toLowerCase());
      } else if (dim.classificationDimension) {
        match = facets.classifications.find(
          (c) =>
            c.dimension === dim.classificationDimension &&
            c.name.toLowerCase() === typed.toLowerCase(),
        )?.slug;
      }

      if (match && !next.getAll(dim.param).includes(match)) {
        next.append(dim.param, match);
      }
    }

    const search = next.toString();
    throw redirect(`/search${search ? `?${search}` : ''}`, { status: 302 });
  }

  const searchQuery = buildSearchQuery(query, params, displayGroups, gaCodes);

  const [facets, searchResult, geographyOptions] = await Promise.all([
    api.get('/api/indicators/facets', indicatorFacetsSchema),
    api.get(
      `/api/indicators/search${searchQuery ? `?${searchQuery}` : ''}`,
      indicatorSearchResultSchema,
    ),
    loadGeographyOptions(api, params, displayGroups),
  ]);

  const validatedGeo = pickStrings(params, 'geo').filter((g) => displayGroups.includes(g));

  return {
    q: query,
    topics: pickStrings(params, 't'),
    indicatorTypes: pickStrings(params, 'it'),
    riskFactors: pickStrings(params, 'rf'),
    frameworks: pickStrings(params, 'fw'),
    populations: pickStrings(params, 'pg'),
    inequalities: pickStrings(params, 'eq'),
    sources: pickStrings(params, 'src'),
    valueTypes: pickStrings(params, 'vt'),
    yearTypes: pickStrings(params, 'per'),
    geoLevels: validatedGeo,
    gaCodes,
    gaAreaNames,
    displayGroups,
    facets,
    searchResult,
    geographyOptions,
    areasLimited:
      pickStrings(params, 'ga').filter((code) => AREA_CODE_RE.test(code)).length >
      MAX_SELECTED_AREAS,
  };
}
