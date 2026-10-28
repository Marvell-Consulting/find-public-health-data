import { tableAreaSeries } from '@fphd/utils/observation-series';
import { inArray } from 'drizzle-orm';
import type { Database } from './client.ts';
import {
  getIndicatorObservationsForAreas,
  getPublishedIndicatorsByIds,
} from './indicator-repository.ts';
import { publishedIndicator } from './schema/index.ts';

export async function getIndicatorTableData(db: Database, shortIds: number[], areaCodes: string[]) {
  if (!shortIds.length || !areaCodes.length) return [];
  const identities = await db
    .select({ id: publishedIndicator.id, shortId: publishedIndicator.shortId })
    .from(publishedIndicator)
    .where(inArray(publishedIndicator.shortId, shortIds));
  const ids = identities.map(({ id }) => id);
  const [details, observationEntries] = await Promise.all([
    getPublishedIndicatorsByIds(db, ids),
    Promise.all(
      ids.map(
        async (id) => [id, await getIndicatorObservationsForAreas(db, id, areaCodes)] as const,
      ),
    ),
  ]);
  const data = new Map(observationEntries);
  const byShortId = new Map(identities.map(({ id, shortId }) => [shortId, id]));
  return shortIds.flatMap((shortId) => {
    const id = byShortId.get(shortId);
    const detail = id ? details.get(id) : undefined;
    return detail && id ? [{ detail, areaData: tableAreaSeries(data.get(id) ?? []) }] : [];
  });
}
