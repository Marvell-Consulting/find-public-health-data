import type { Server } from 'node:http';

import { installShutdownHandlers, type ShutdownOptions } from '@fphd/server-lifecycle';
import express, { type Express } from 'express';

import { universalSecurityHeaders } from './security-headers.js';

export { UNIVERSAL_SECURITY_HEADERS, universalSecurityHeaders } from './security-headers.js';

/**
 * The Express every app in this workspace starts from, so the things all four must agree on
 * are settled once rather than mirrored between `@fphd/api-server` and `@fphd/web-server` —
 * those two must not import one another, and a copy in each drifts.
 *
 * The probe paths follow Kubernetes' own convention for its control-plane components. The `z`
 * keeps them out of the way of the routes a public health data catalogue might plausibly want:
 * `/health` is a name this product could legitimately serve content on.
 */
export function createBaseApp({ serviceName }: { serviceName: string }): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(universalSecurityHeaders());

  // Liveness answers while the process is running at all, including throughout a stop — the
  // process is alive and still serving the whole time, and failing this asks to be restarted
  // rather than to be left alone to finish.
  app.get('/livez', (_request, response) => {
    response.status(200).json({ status: 'ok', service: serviceName });
  });

  // Readiness is the one that changes: from the moment a signal arrives the replica must stop
  // being routed to, while it goes on serving what it has already been sent. It reads the flag
  // off `app.locals` so the drain reaches it without a capability threaded through every factory.
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
  /** How long to keep serving after the signal, before closing anything. */
  drainDelayMs?: ShutdownOptions['drainDelayMs'];
  /** The budget for the whole stop; keep it under the platform's grace period. */
  gracePeriodMs?: ShutdownOptions['gracePeriodMs'];
  host: string;
  /** Reports a stop that failed; the lifecycle package cannot log. */
  onError?: ShutdownOptions['onError'];
  /** Reports requests destroyed because the grace period expired with work still in flight. */
  onForcedClose?: ShutdownOptions['onForcedClose'];
  onListening: () => void;
  /** Runs once the server has stopped serving — close the database pool here. */
  onShutdown?: ShutdownOptions['onShutdown'];
  port: number;
}

/**
 * Listens, and stops gracefully when the platform says to. Every app goes through here, so
 * none of them can be left without signal handlers, and the readiness flag is wired to the
 * drain in exactly one place.
 */
export function startServer({
  app,
  drainDelayMs,
  gracePeriodMs,
  host,
  onError,
  onForcedClose,
  onListening,
  onShutdown,
  port,
}: StartServerOptions): Server {
  const server = app.listen(port, host, onListening);

  installShutdownHandlers(server, {
    drainDelayMs,
    gracePeriodMs,
    onDraining: () => {
      app.locals.draining = true;
    },
    onError,
    onForcedClose,
    onShutdown,
  });

  return server;
}
