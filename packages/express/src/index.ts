import type { Server } from 'node:http';

import express, { type Express } from 'express';

import { universalSecurityHeaders } from './security-headers.js';
import { installShutdownHandlers, type ShutdownOptions } from './shutdown.js';

export { universalSecurityHeaders } from './security-headers.js';
export { serverLogging } from './server-logging.js';

/**
 * The Express every app starts from, so what all four must agree on is settled once rather than
 * mirrored between `@fphd/api-server` and `@fphd/web-server`, which must not import one another.
 *
 * The probe paths follow Kubernetes' convention for its own control-plane components; the `z`
 * keeps them clear of the routes a public health data catalogue might want, `/health` above all.
 */
export function createBaseApp({ serviceName }: { serviceName: string }): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(universalSecurityHeaders());

  // Answers throughout a stop: the process is alive and serving the whole time, and failing
  // this asks to be restarted rather than left alone to finish.
  app.get('/livez', (_request, response) => {
    response.status(200).json({ status: 'ok', service: serviceName });
  });

  // Readiness is the one that changes, so the ingress stops routing here while the replica goes
  // on serving what it was already sent. Off `app.locals`, so the drain reaches it without a
  // capability threaded through every app factory.
  app.get('/readyz', (request, response) => {
    const draining = request.app.locals.draining === true;
    response
      .status(draining ? 503 : 200)
      .json({ status: draining ? 'draining' : 'ok', service: serviceName });
  });

  return app;
}

export interface StartServerOptions {
  app: Express;
  host: string;
  port: number;
  /** Taken whole from `config.shutdown`, so no app can pass one number and forget the other. */
  shutdown: Pick<ShutdownOptions, 'drainDelayMs' | 'gracePeriodMs'>;
  onListening: () => void;
  onShutdown?: ShutdownOptions['onShutdown'];
  onForcedClose?: ShutdownOptions['onForcedClose'];
  onError?: ShutdownOptions['onError'];
}

/**
 * Listens, and stops gracefully when the platform says to. Every app goes through here, so none
 * can be left without signal handlers, and the readiness flag is wired to the drain in one place.
 */
export function startServer({
  app,
  host,
  port,
  shutdown,
  onListening,
  onShutdown,
  onForcedClose,
  onError,
}: StartServerOptions): Server {
  const server = app.listen(port, host, onListening);

  installShutdownHandlers(server, {
    ...shutdown,
    onDraining: () => {
      app.locals.draining = true;
    },
    onShutdown,
    onForcedClose,
    onError,
  });

  return server;
}
