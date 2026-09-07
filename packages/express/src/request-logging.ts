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

/**
 * The address that connected to the ingress proxy, which appends it as the last X-Forwarded-For
 * value: Front Door for traffic through the edge, a sibling app for a call inside the
 * environment. It answers routing and allow-list questions. It is not the end user's address,
 * which sits further left and stays out of the log; the edge access log already holds it.
 */
function peerAddress(forwardedFor: string | string[] | undefined): string | undefined {
  const last = (Array.isArray(forwardedFor) ? forwardedFor.at(-1) : forwardedFor)
    ?.split(',')
    .at(-1)
    ?.trim();
  return last === '' ? undefined : last;
}

/** One line per response through the shared logger, so requests filter and aggregate like every
 * other line. Probes are skipped: their traffic would otherwise dominate the log. */
export function requestLogging(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    // A caller's id is kept so a web line and its API line share one; anything else is minted.
    genReqId: (request) => readRequestIdHeader(request.headers[REQUEST_ID_HEADER]) ?? uuidv7(),
    autoLogging: { ignore: (request) => probePaths.has(pathOf(request.url)) },
    customLogLevel: (_request, response) => (response.statusCode >= 500 ? 'error' : 'info'),
    // A 5xx with no error attached gets one invented by pino-http, whose stack points at itself.
    customErrorObject: (_request, response, _error, { err, ...rest }: ErrorObject) =>
      response.err === undefined ? rest : { err, ...rest },
    // Headers stay out of the line, the session cookie being one, bar the two named here.
    serializers: {
      req: (request: StdSerializedResults['req']) => ({
        id: request.id,
        method: request.method,
        url: request.url,
        // Front Door's reference for the request, the same value its access log records.
        ...optional('azureRef', singleHeader(request.headers['x-azure-ref'])),
        ...optional('peer', peerAddress(request.headers['x-forwarded-for'])),
      }),
      res: (response: StdSerializedResults['res']) => ({ statusCode: response.statusCode }),
    },
  });
}
