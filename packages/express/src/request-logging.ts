import type { Logger } from '@fphd/logger';
import type { RequestHandler } from 'express';
import { pinoHttp, type StdSerializedResults } from 'pino-http';

const probePaths = new Set(['/livez', '/readyz']);

interface ErrorObject {
  err: unknown;
  res: unknown;
  responseTime: number;
}

/** One line per response through the shared logger, so requests filter and aggregate like every
 * other line. Probes are skipped: their traffic would otherwise dominate the log. */
export function requestLogging(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    autoLogging: { ignore: (request) => probePaths.has(request.url ?? '') },
    customLogLevel: (_request, response) => (response.statusCode >= 500 ? 'error' : 'info'),
    // A 5xx with no error attached gets one invented by pino-http, whose stack points at itself.
    customErrorObject: (_request, response, _error, { err, ...rest }: ErrorObject) =>
      response.err === undefined ? rest : { err, ...rest },
    // Headers stay out of the line: the session cookie is one of them.
    serializers: {
      req: (request: StdSerializedResults['req']) => ({ method: request.method, url: request.url }),
      res: (response: StdSerializedResults['res']) => ({ statusCode: response.statusCode }),
    },
  });
}
