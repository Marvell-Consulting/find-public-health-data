import {
  areaDisplayGroupListSchema,
  areaLookupListSchema,
  DEFAULT_AREA_SEARCH_RESULTS,
  MAX_AREA_NAME_LENGTH,
  MAX_AREA_PREVIEW,
} from '@fphd/public-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';

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
): Promise<NonNullable<GeographyOptions['previews']>> {
  if (levels.length === 0) return [];
  const query = levels.map((name) => `displayGroup=${encodeURIComponent(name)}`).join('&');
  const groups = await api.get(
    `/api/areas?${query}&limit=${MAX_AREA_PREVIEW}`,
    areaDisplayGroupListSchema,
  );
  return levels.flatMap((name) =>
    groups
      .filter((group) => group.displayGroup === name)
      .map(({ displayGroup, areas }) => ({ name: displayGroup, areas })),
  );
}

export async function findGeographyGroups(
  api: ApiClient,
  { query = '', level = '' }: { query?: string; level?: string },
): Promise<GeographyOptions['groups']> {
  if (level.length > MAX_AREA_NAME_LENGTH) return [];
  if (level) {
    const groups = await api.get(
      `/api/areas?displayGroup=${encodeURIComponent(level)}&limit=${MAX_AREA_PREVIEW}`,
      areaDisplayGroupListSchema,
    );
    return groups.map(({ displayGroup, areas }) => ({ name: displayGroup, areas }));
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
  return [...byLevel].map(([name, areas]) => ({ name, areas }));
}

export async function loadGeographyOptions(
  api: ApiClient,
  params: URLSearchParams,
  levels: string[],
): Promise<GeographyOptions> {
  const requestedLevel = params.get('geo-level') ?? '';
  const level = levels.includes(requestedLevel) ? requestedLevel : '';
  const query = level ? '' : (params.get('geo-q')?.trim().slice(0, MAX_AREA_NAME_LENGTH) ?? '');
  const result: GeographyOptions = { query, level, groups: [], error: false };
  const previews = loadGeographyPreviews(api, levels).catch(() => {
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
      findGeographyGroups(api, { query, level }),
    ]);
    result.previews = loadedPreviews;
    result.groups = levels.flatMap((name) => groups.filter((group) => group.name === name));
  } catch {
    result.previews = await previews;
    result.error = true;
  }
  return result;
}
