import { addNotFoundHandler, createApiApp, requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Repositories } from '@fphd/db';
import { type InternalRepositories, internalApiRoutes } from '@fphd/internal-api-features';
import { publicApiRoutes } from '@fphd/public-api-features';

export interface AppDependencies {
  repositories: Repositories;
  internalRepositories: InternalRepositories;
  session: JwtSessionVerifier;
}

export function createApp({ repositories, internalRepositories, session }: AppDependencies) {
  const app = createApiApp('internal-api');

  app.use(publicApiRoutes(repositories));

  app.get('/api/internal', requireJwtRole(session, 'internal'), (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'internal',
    });
  });

  app.use(internalApiRoutes({ repositories: internalRepositories, session }));

  addNotFoundHandler(app);
  return app;
}
