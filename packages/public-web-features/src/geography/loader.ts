import {
  areaDisplayGroupListSchema,
  areaLookupListSchema,
  DEFAULT_AREA_SEARCH_RESULTS,
  MAX_AREA_NAME_LENGTH,
  MAX_AREA_PREVIEW,
} from '@fphd/public-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';
import { publicGeographyGroups, sourceGeographyGroup } from './groups.ts';

export interface GeographyOptions {
  query: string;
  level: string;
  groups: { name: string; areas: { code: string; name: string }[] }[];
  previews?: { name: string; areas: { code: string; name: string }[] }[];
  error: boolean;
}

async function loadGeographyPreviews(
  api: ApiClient,
  levels: string[],
  indicator?: string,
  publicOnly = false,
): Promise<NonNullable<GeographyOptions['previews']>> {
  if (levels.length === 0) return [];
  const sourceLevels = [...new Set(levels.map(sourceGeographyGroup))];
  const query = sourceLevels.map((name) => `displayGroup=${encodeURIComponent(name)}`).join('&');
  const groups = await api.get(
    indicator
      ? `/api/indicators/${encodeURIComponent(indicator)}/areas?limit=${MAX_AREA_PREVIEW}`
      : `/api/areas?${query}&limit=${MAX_AREA_PREVIEW}`,
    areaDisplayGroupListSchema,
  );
  const previews = groups.map(({ displayGroup, areas }) => ({ name: displayGroup, areas }));
  return publicOnly
    ? publicPreviews(api, previews, indicator)
    : previews.filter((group) => levels.includes(group.name));
}

async function publicPreviews(
  api: ApiClient,
  groups: GeographyOptions['groups'],
  indicator?: string,
) {
  let complete = groups;
  if (groups.some((group) => group.name === 'Local authorities')) {
    const local = await api.get(
      indicator
        ? `/api/indicators/${encodeURIComponent(indicator)}/areas?displayGroup=Local%20authorities`
        : '/api/areas?displayGroup=Local%20authorities',
      areaDisplayGroupListSchema,
    );
    complete = [
      ...groups.filter((group) => group.name !== 'Local authorities'),
      ...local.map(({ displayGroup, areas }) => ({ name: displayGroup, areas })),
    ];
  }
  return publicGeographyGroups(complete).map((group) => ({
    ...group,
    areas: group.areas.slice(0, MAX_AREA_PREVIEW),
  }));
}

export async function findGeographyGroups(
  api: ApiClient,
  {
    query = '',
    level = '',
    indicator,
    publicOnly = false,
  }: {
    query?: string;
    level?: string;
    indicator?: string | undefined;
    publicOnly?: boolean | undefined;
  },
): Promise<GeographyOptions['groups']> {
  if (level.length > MAX_AREA_NAME_LENGTH) return [];
  const sourceLevel = publicOnly ? sourceGeographyGroup(level) : level;
  const present = (groups: GeographyOptions['groups']) =>
    publicOnly
      ? publicGeographyGroups(groups)
          .filter((group) => !level || group.name === level)
          .map((group) => ({ ...group, areas: group.areas.slice(0, MAX_AREA_PREVIEW) }))
      : groups;
  if (indicator) {
    const params = new URLSearchParams({ limit: String(MAX_AREA_PREVIEW) });
    if (sourceLevel) params.set('displayGroup', sourceLevel);
    if (publicOnly && sourceLevel === 'Local authorities') params.delete('limit');
    if (query.trim()) params.set('q', query.trim().slice(0, MAX_AREA_NAME_LENGTH));
    const groups = await api.get(
      `/api/indicators/${encodeURIComponent(indicator)}/areas?${params}`,
      areaDisplayGroupListSchema,
    );
    return present(groups.map(({ displayGroup, areas }) => ({ name: displayGroup, areas })));
  }
  if (level) {
    const groups = await api.get(
      `/api/areas?displayGroup=${encodeURIComponent(sourceLevel)}${publicOnly && sourceLevel === 'Local authorities' ? '' : `&limit=${MAX_AREA_PREVIEW}`}`,
      areaDisplayGroupListSchema,
    );
    return present(groups.map(({ displayGroup, areas }) => ({ name: displayGroup, areas })));
  }

  const search = query.trim().slice(0, MAX_AREA_NAME_LENGTH);
  if (!search) return [];
  const matches = await api.get(
    `/api/areas/search?q=${encodeURIComponent(search)}&limit=${DEFAULT_AREA_SEARCH_RESULTS}`,
    areaLookupListSchema,
  );
  const byLevel = new Map<string, { code: string; name: string }[]>();
  for (const { code, name, displayGroup } of matches) {
    if (!displayGroup) continue;
    const areas = byLevel.get(displayGroup) ?? [];
    areas.push({ code, name });
    byLevel.set(displayGroup, areas);
  }
  return present([...byLevel].map(([name, areas]) => ({ name, areas })));
}

export async function loadGeographyOptions(
  api: ApiClient,
  params: URLSearchParams,
  levels: string[],
  scope: {
    indicator?: string | undefined;
    previews?: { displayGroup: string; areas: { code: string; name: string }[] }[] | undefined;
    publicOnly?: boolean | undefined;
  } = {},
): Promise<GeographyOptions> {
  const requestedLevel = params.get('geo-level') ?? '';
  const level = levels.includes(requestedLevel) ? requestedLevel : '';
  const query = level ? '' : (params.get('geo-q')?.trim().slice(0, MAX_AREA_NAME_LENGTH) ?? '');
  const result: GeographyOptions = { query, level, groups: [], error: false };
  const previews = (
    scope.previews
      ? scope.publicOnly
        ? publicPreviews(
            api,
            scope.previews.map(({ displayGroup, areas }) => ({ name: displayGroup, areas })),
            scope.indicator,
          )
        : Promise.resolve(
            scope.previews.map(({ displayGroup, areas }) => ({ name: displayGroup, areas })),
          )
      : loadGeographyPreviews(api, levels, scope.indicator, scope.publicOnly)
  ).catch(() => {
    // The picker can still fetch a level when it expands if its page preview failed.
    return [];
  });
  if (!query && !level) {
    result.previews = await previews;
    return result;
  }

  try {
    const [loadedPreviews, groups] = await Promise.all([
      previews,
      findGeographyGroups(api, {
        query,
        level,
        indicator: scope.indicator,
        publicOnly: scope.publicOnly,
      }),
    ]);
    result.previews = loadedPreviews;
    result.groups = levels.flatMap((name) => groups.filter((group) => group.name === name));
  } catch {
    result.previews = await previews;
    result.error = true;
  }
  return result;
}
