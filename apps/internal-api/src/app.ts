import { addNotFoundHandler, createApiApp, requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';

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
  session: JwtSessionVerifier;
  topics: TopicsReader;
}

export function createApp({ session, topics }: AppDependencies) {
  const app = createApiApp('internal-api');

  app.get('/api/topics', async (_request, response) => {
    response.status(200).json(await topics.list());
  });

  app.get('/api/internal', requireJwtRole(session, 'internal'), (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'internal',
    });
  });

  addNotFoundHandler(app);
  return app;
}
