import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { InvalidJwtSessionError } from '@fphd/auth/session-errors';
import express, { type Express } from 'express';

export function createApiApp(serviceName: string): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: serviceName });
  });

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

export function requireJwtRole(verifier: JwtSessionVerifier, role: string): express.RequestHandler {
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

interface StartApiServerOptions {
  app: Express;
  host: string;
  onListening: () => void;
  port: number;
}

export function startApiServer({ app, host, onListening, port }: StartApiServerOptions) {
  return app.listen(port, host, onListening);
}
