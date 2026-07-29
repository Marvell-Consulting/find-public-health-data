import { addNotFoundHandler, createApiApp, requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Repositories } from '@fphd/db';
import { publicApiRoutes } from '@fphd/public-api-features';

export interface AppDependencies {
  repositories: Repositories;
  session: JwtSessionVerifier;
}

export function createApp({ repositories, session }: AppDependencies) {
  const app = createApiApp('internal-api');

  app.use(publicApiRoutes(repositories));

  app.get('/api/internal', requireJwtRole(session, 'internal'), (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'internal',
    });
  });

  addNotFoundHandler(app);
  return app;
}
