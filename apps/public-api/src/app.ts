import { addNotFoundHandler, createApiApp } from '@fphd/api-server';
import type { Repositories } from '@fphd/db';
import type { Logger } from '@fphd/logger';
import { publicApiRoutes } from '@fphd/public-api-features';

export interface AppDependencies {
  logger: Logger;
  repositories: Repositories;
}

export function createApp({ logger, repositories }: AppDependencies) {
  const app = createApiApp({ logger, serviceName: 'public-api' });

  app.use(publicApiRoutes(repositories));

  addNotFoundHandler(app);
  return app;
}
