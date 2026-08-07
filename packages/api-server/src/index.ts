import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { InvalidJwtSessionError } from '@fphd/auth/session-errors';
import { installShutdownHandlers, type ShutdownOptions } from '@fphd/server-lifecycle';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';

interface ApiRateLimitOptions {
  limit: number;
  windowMs: number;
}

interface CreateApiAppOptions {
  rateLimit?: ApiRateLimitOptions;
}

const defaultApiRateLimit: ApiRateLimitOptions = {
  limit: 100,
  windowMs: 15 * 60 * 1_000,
};

export function createApiApp(
  serviceName: string,
  { rateLimit: rateLimitOptions = defaultApiRateLimit }: CreateApiAppOptions = {},
): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  // The same three paths and the same body as `@fphd/web-server` serves, so one probe
  // configuration covers all four apps — mirror any change to one in the other.
  app.get(['/health', '/health/live'], (_request, response) => {
    response.status(200).json({ status: 'ok', service: serviceName });
  });

  // Readiness is separate from the other two: during a stop the process is alive and still
  // serving, but it must stop being routed to before it closes anything.
  app.get('/health/ready', (request, response) => {
    const draining = request.app.locals.draining === true;
    response.status(draining ? 503 : 200).json({
      status: draining ? 'draining' : 'ok',
      service: serviceName,
    });
  });

  app.use(
    '/api',
    rateLimit({
      legacyHeaders: false,
      limit: rateLimitOptions.limit,
      standardHeaders: 'draft-8',
      windowMs: rateLimitOptions.windowMs,
    }),
  );

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
  /** How long to keep serving after the signal, before closing anything. */
  drainMs?: ShutdownOptions['drainMs'];
  host: string;
  /** Reports a stop that failed; the lifecycle package cannot log. */
  onError?: ShutdownOptions['onError'];
  onListening: () => void;
  /** Runs once the server has stopped serving — close the database pool here. */
  onShutdown?: ShutdownOptions['onShutdown'];
  port: number;
}

export function startApiServer({
  app,
  drainMs,
  host,
  onError,
  onListening,
  onShutdown,
  port,
}: StartApiServerOptions) {
  const server = app.listen(port, host, onListening);

  installShutdownHandlers(server, {
    drainMs,
    // `app.locals` rather than a capability threaded through `createApp`: the readiness route
    // reads it off the request, so the flag reaches it without a new argument on every factory.
    onDraining: () => {
      app.locals.draining = true;
    },
    onError,
    onShutdown,
  });

  return server;
}
