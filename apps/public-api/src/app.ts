import { addNotFoundHandler, createApiApp } from '@fphd/api-server';
import type { Repositories } from '@fphd/db';
import { publicApiRoutes } from '@fphd/public-api-features';

export interface AppDependencies {
  repositories: Repositories;
  rateLimit?: { limit: number; windowMs: number };
}

export function createApp({ repositories, rateLimit }: AppDependencies) {
  const app = createApiApp('public-api', rateLimit ? { rateLimit } : undefined);

  app.use(publicApiRoutes(repositories));

  addNotFoundHandler(app);
  return app;
}
