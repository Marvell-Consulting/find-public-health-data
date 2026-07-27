import { addNotFoundHandler, createApiApp, requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';

export function createApp(session: JwtSessionVerifier) {
  const app = createApiApp('internal-api');

  app.get('/api/internal', requireJwtRole(session, 'internal'), (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'internal',
    });
  });

  addNotFoundHandler(app);
  return app;
}
