import {
  areaDisplayGroupListSchema,
  areaLookupListSchema,
} from '@fphd/public-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

/**
 * Resource route behind the geography tree: `?level=` answers one display level's areas
 * for lazy expansion, `?q=` searches every level server-side. Both keep the catalogue
 * out of the page payload the way the indicator quicksearch does.
 */
export async function loader({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const api = context.get(apiContext);

  const level = url.searchParams.get('level') ?? '';
  if (level.length > 100) {
    // The API would 400 an overlong name; an impossible level is just an empty one.
    return Response.json({ areas: [] });
  }
  if (level) {
    const groups = await api.get(
      `/api/areas?display_group=${encodeURIComponent(level)}`,
      areaDisplayGroupListSchema,
    );
    return Response.json({ areas: groups.flatMap(({ areas }) => areas) });
  }

  const query = url.searchParams.get('q')?.trim() ?? '';
  if (!query) {
    return Response.json({ groups: [] });
  }
  const matches = await api.get(
    `/api/areas/search?q=${encodeURIComponent(query)}&limit=50`,
    areaLookupListSchema,
  );
  const byLevel = new Map<string, { code: string; name: string }[]>();
  for (const { code, name, displayGroup } of matches) {
    if (!displayGroup) {
      continue;
    }
    const entry = byLevel.get(displayGroup) ?? [];
    entry.push({ code, name });
    byLevel.set(displayGroup, entry);
  }
  return Response.json({
    groups: [...byLevel.entries()].map(([name, areas]) => ({ name, areas })),
  });
}
