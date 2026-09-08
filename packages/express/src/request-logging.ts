import type { Logger } from '@fphd/logger';
import type { RequestHandler } from 'express';
import { pinoHttp, type StdSerializedResults } from 'pino-http';

import { REQUEST_ID_HEADER, readRequestIdHeader, uuidv7 } from './request-id.js';

const probePaths = new Set(['/livez', '/readyz']);

function pathOf(url: string | undefined): string {
  return url?.split('?', 1)[0] ?? '';
}

interface ErrorObject {
  err: unknown;
  res: unknown;
  responseTime: number;
}

function optional<K extends string>(key: K, value: string | undefined): { [P in K]?: string } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]: string });
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface RequestLoggingOptions {
  /** Keep the id a web app forwarded, so its line and this one share it. Off for the web apps
   * themselves: a browser's header is never trusted. */
  acceptsForwardedId?: boolean;
}

/** One line per response through the shared logger, so requests filter and aggregate like every
 * other line. Probes are skipped: their traffic would otherwise dominate the log. */
export function requestLogging(
  logger: Logger,
  { acceptsForwardedId = false }: RequestLoggingOptions = {},
): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (request, response) => {
      const id =
        (acceptsForwardedId ? readRequestIdHeader(request.headers[REQUEST_ID_HEADER]) : undefined) ??
        uuidv7();
      // Echoed to the caller, so whoever made the request can find its lines.
      response.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    autoLogging: { ignore: (request) => probePaths.has(pathOf(request.url)) },
    customLogLevel: (_request, response) => (response.statusCode >= 500 ? 'error' : 'info'),
    // A 5xx with no error attached gets one invented by pino-http, whose stack points at itself.
    customErrorObject: (_request, response, _error, { err, ...rest }: ErrorObject) =>
      response.err === undefined ? rest : { err, ...rest },
    // No headers (one is the session cookie) and no client address (personal data, and the edge
    // access log already has it). Only the Front Door reference below is kept.
    serializers: {
      req: (request: StdSerializedResults['req']) => ({
        id: request.id,
        method: request.method,
        url: request.url,
        // Front Door's reference for the request, the same value its access log records.
        ...optional('azureRef', singleHeader(request.headers['x-azure-ref'])),
      }),
      res: (response: StdSerializedResults['res']) => ({ statusCode: response.statusCode }),
    },
  });
}
