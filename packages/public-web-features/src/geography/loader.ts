import {
  areaDisplayGroupListSchema,
  areaLookupListSchema,
} from '@fphd/public-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';

export interface GeographyOptions {
  query: string;
  level: string;
  groups: { name: string; areas: { code: string; name: string }[] }[];
  error: boolean;
}

export async function findGeographyGroups(
  api: ApiClient,
  { query = '', level = '' }: { query?: string; level?: string },
): Promise<GeographyOptions['groups']> {
  if (level.length > 100) return [];
  if (level) {
    const groups = await api.get(
      `/api/areas?displayGroup=${encodeURIComponent(level)}`,
      areaDisplayGroupListSchema,
    );
    return groups.map(({ displayGroup, areas }) => ({ name: displayGroup, areas }));
  }

  const search = query.trim().slice(0, 100);
  if (!search) return [];
  const matches = await api.get(
    `/api/areas/search?q=${encodeURIComponent(search)}&limit=50`,
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
  const query = level ? '' : (params.get('geo-q')?.trim().slice(0, 100) ?? '');
  const result: GeographyOptions = { query, level, groups: [], error: false };
  if (!query && !level) return result;

  try {
    const groups = await findGeographyGroups(api, { query, level });
    result.groups = levels.flatMap((name) => groups.filter((group) => group.name === name));
  } catch {
    result.error = true;
  }
  return result;
}
