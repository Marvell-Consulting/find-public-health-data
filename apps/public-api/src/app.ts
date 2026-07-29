import { addNotFoundHandler, createApiApp } from '@fphd/api-server';
import type { Repositories } from '@fphd/db';
import { publicApiRoutes } from '@fphd/public-api-features';

export interface AppDependencies {
  repositories: Repositories;
}

export function createApp({ repositories }: AppDependencies) {
  const app = createApiApp('public-api');

  app.use(publicApiRoutes(repositories));

  addNotFoundHandler(app);
  return app;
}
