import { areaGroupListSchema, areaLookupListSchema } from '@fphd/public-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

import {
  ALL_DISPLAY_AREA_TYPES,
  cleanAreaName,
  displayLevelOf,
  levelAreaTypes,
} from '../geography-display';

/**
 * Resource route behind the geography tree: `?level=` answers one display level's areas
 * for lazy expansion, `?q=` searches every level server-side. Both keep the catalogue
 * out of the page payload the way the indicator quicksearch does.
 */
export async function loader({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const api = context.get(apiContext);

  const level = url.searchParams.get('level') ?? '';
  if (level) {
    const types = levelAreaTypes(level);
    if (types.length === 0) {
      return Response.json({ areas: [] });
    }
    const groups = await api.get(
      `/api/areas?${types.map((name) => `area_type=${encodeURIComponent(name)}`).join('&')}`,
      areaGroupListSchema,
    );
    const areas = groups
      .flatMap(({ areas: levelAreas }) => levelAreas)
      .map(({ code, name }) => ({ code, name: cleanAreaName(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({ areas });
  }

  const query = url.searchParams.get('q')?.trim() ?? '';
  if (!query) {
    return Response.json({ groups: [] });
  }
  const matches = await api.get(
    `/api/areas/search?q=${encodeURIComponent(query)}&limit=50&${ALL_DISPLAY_AREA_TYPES.map(
      (name) => `area_type=${encodeURIComponent(name)}`,
    ).join('&')}`,
    areaLookupListSchema,
  );
  const byLevel = new Map<string, { code: string; name: string }[]>();
  for (const { code, name, areaType } of matches) {
    const matchLevel = displayLevelOf(areaType);
    if (!matchLevel) {
      continue;
    }
    const entry = byLevel.get(matchLevel) ?? [];
    entry.push({ code, name: cleanAreaName(name) });
    byLevel.set(matchLevel, entry);
  }
  return Response.json({
    groups: [...byLevel.entries()].map(([name, areas]) => ({ name, areas })),
  });
}
