import { addNotFoundHandler, createApiApp } from '@fphd/api-server';
import { type Database, schema } from '@fphd/db';
import { asc, eq } from 'drizzle-orm';

export interface TopicSummary {
  slug: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicsReader {
  list(): Promise<TopicSummary[]>;
}

export interface AppDependencies {
  db: Database;
  topics: TopicsReader;
}

export function createApp({ db, topics }: AppDependencies) {
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

  app.get('/api/topics', async (_request, response) => {
    response.status(200).json(await topics.list());
  });

  addNotFoundHandler(app);
  return app;
}
