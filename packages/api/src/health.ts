import type { RequestHandler } from 'express';

export interface HealthHandlerOptions {
  /** Identifies the responding app in the payload (e.g. 'public-api'). */
  service: string;
}

/**
 * A shallow liveness check: it answers "is this process serving requests", nothing more.
 * It deliberately touches no dependency, so a database outage never takes the app out of
 * its load balancer alongside the database.
 */
export function healthHandler({ service }: HealthHandlerOptions): RequestHandler {
  return (_request, response) => {
    response.status(200).json({ status: 'ok', service });
  };
}
