import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { InvalidJwtSessionError } from '@fphd/auth/session-errors';
import {
  createBaseApp,
  requestLogging,
  type StartServerOptions,
  serverLogging,
  startServer,
} from '@fphd/express';
import type { Logger } from '@fphd/logger';
import type { Express, RequestHandler, Response } from 'express';
import { json } from 'express';

export function createApiApp({
  logger,
  serviceName,
}: {
  logger: Logger;
  serviceName: string;
}): Express {
  const app = createBaseApp({ serviceName });

  // Ahead of every route, so a miss is logged as well as a hit. The probes sit on the base app
  // above and never reach it. The id a web app forwarded is kept, so both logs share it.
  app.use(requestLogging(logger, { acceptsForwardedId: true }));
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

/** Who a request is acting as, for a handler that writes rows carrying the actor. */
export interface ApiSession {
  roles: readonly string[];
  sub: string;
}

// Express types every local as `any`, so both ends of the one key we set go through this view.
function sessionLocals(response: Response): { apiSession?: ApiSession } {
  return response.locals;
}

/** The session `requireJwtRole` verified; only a handler mounted behind it can ask for it. */
export function requireApiSession(response: Response): ApiSession {
  const session = sessionLocals(response).apiSession;

  if (session === undefined) {
    throw new Error('requireApiSession called outside a route guarded by requireJwtRole');
  }

  return session;
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

      sessionLocals(response).apiSession = { roles: session.roles, sub: session.sub };

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
