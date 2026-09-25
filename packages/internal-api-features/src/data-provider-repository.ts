import { type Database, schema } from '@fphd/db';
import { asc, eq } from 'drizzle-orm';

const { dataProvider, dataProviderSource } = schema;

export interface DataProviderRow {
  id: string;
  name: string;
  sources: { id: string; name: string }[];
}

/** Every provider with its sources, each in the order the publisher's form lists them. */
export async function listDataProviders(db: Database): Promise<DataProviderRow[]> {
  const rows = await db
    .select({
      id: dataProvider.id,
      name: dataProvider.name,
      sourceId: dataProviderSource.id,
      sourceName: dataProviderSource.name,
    })
    .from(dataProvider)
    .leftJoin(dataProviderSource, eq(dataProviderSource.providerId, dataProvider.id))
    .orderBy(asc(dataProvider.name), asc(dataProviderSource.name));
  const providers = new Map<string, DataProviderRow>();

  for (const { id, name, sourceId, sourceName } of rows) {
    const provider = providers.get(id) ?? { id, name, sources: [] };

    providers.set(id, provider);
    if (sourceId !== null && sourceName !== null) {
      provider.sources.push({ id: sourceId, name: sourceName });
    }
  }

  return [...providers.values()];
}
