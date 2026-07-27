import { addNotFoundHandler, createApiApp } from '@fphd/api-server';
import { type Database, schema } from '@fphd/db';
import { asc, eq } from 'drizzle-orm';

export interface AppDependencies {
  db: Database;
}

export function createApp({ db }: AppDependencies) {
  const app = createApiApp('public-api');

  app.get('/api/indicators', async (_request, response) => {
    const indicators = await db
      .select({
        id: schema.indicator.id,
        fingertipsId: schema.indicator.fingertipsId,
        name: schema.indicator.name,
        status: schema.indicator.status,
      })
      .from(schema.indicator)
      .where(eq(schema.indicator.status, 'approved'))
      .orderBy(asc(schema.indicator.name));
    response.json({ indicators });
  });

  addNotFoundHandler(app);
  return app;
}
