import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { InvalidJwtSessionError } from '@fphd/auth/session-errors';
import { createBaseApp, type StartServerOptions, serverLogging, startServer } from '@fphd/express';
import type { Express, RequestHandler } from 'express';
import { json } from 'express';

export function createApiApp(serviceName: string): Express {
  const app = createBaseApp({ serviceName });

  app.use(json());

  app.get('/api', (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'public',
    });
  });

  return app;
}

export function addNotFoundHandler(app: Express) {
  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });
}

export function requireJwtRole(verifier: JwtSessionVerifier, role: string): RequestHandler {
  return async (request, response, next) => {
    const token = verifier.readToken(request.headers.cookie ?? null);

    if (token === undefined) {
      response.status(401).json({ error: 'authentication_required' });
      return;
    }

    try {
      const session = await verifier.verifyToken(token);

      if (!session.roles.includes(role)) {
        response.status(403).json({ error: 'forbidden' });
        return;
      }

      next();
    } catch (error) {
      if (!(error instanceof InvalidJwtSessionError)) throw error;
      response.setHeader('Set-Cookie', verifier.clearCookieHeader());
      response.status(401).json({ error: 'invalid_session' });
    }
  };
}

// Re-exported so an API app has one import source, but not wrapped: nothing about starting a
// server is API-specific, and a `startApiServer` that only forwarded would imply otherwise.
export { type StartServerOptions, serverLogging, startServer };
