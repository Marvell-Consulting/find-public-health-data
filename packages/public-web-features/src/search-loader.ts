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

import { DIMENSIONS } from './search-url.js';

export type {
  IndicatorFacets,
  IndicatorSearchResult,
  IndicatorSearchRow,
} from '@fphd/public-api-features/contract';

const MAX_GA = 100;
const AREA_CODE_RE = /^[A-Z0-9]+$/i;

function pickStrings(params: URLSearchParams, key: string): string[] {
  return [...new Set(params.getAll(key).filter((v) => v !== '' && v.length <= 100))].slice(0, 100);
}

function buildSearchQuery(
  params: URLSearchParams,
  displayGroups: string[],
  resolvedGaGroups: string[],
): string {
  const parts: string[] = [];

  const q = params.get('q')?.trim() ?? '';
  if (q) {
    parts.push(`q=${encodeURIComponent(q.slice(0, 200))}`);
  }

  for (const dim of DIMENSIONS) {
    for (const val of pickStrings(params, dim.param)) {
      parts.push(`${dim.param}=${encodeURIComponent(val)}`);
    }
  }

  const validatedGeo = pickStrings(params, 'geo').filter((g) => displayGroups.includes(g));
  const allDisplayGroups = [...new Set([...validatedGeo, ...resolvedGaGroups])];
  for (const g of allDisplayGroups) {
    parts.push(`display_group=${encodeURIComponent(g)}`);
  }

  return parts.join('&');
}

export async function loadSearch({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const api = context.get(apiContext);

  const addParams = DIMENSIONS.map((d) => d.param);
  const hasAddControl = addParams.some((p) => params.has(`${p}-add`));

  const rawGa = pickStrings(params, 'ga')
    .filter((code) => AREA_CODE_RE.test(code))
    .slice(0, MAX_GA);

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
  const resolvedGaGroups = [...new Set(resolved.map((a) => a.displayGroup))];

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

  const searchQuery = buildSearchQuery(params, displayGroups, resolvedGaGroups);

  const [facets, searchResult] = await Promise.all([
    api.get('/api/indicators/facets', indicatorFacetsSchema),
    api.get(
      `/api/indicators/search${searchQuery ? `?${searchQuery}` : ''}`,
      indicatorSearchResultSchema,
    ),
  ]);

  const validatedGeo = pickStrings(params, 'geo').filter((g) => displayGroups.includes(g));

  return {
    q: params.get('q')?.trim() ?? '',
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
  };
}
