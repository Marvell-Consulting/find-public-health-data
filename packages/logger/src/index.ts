import { type Logger, type LoggerOptions, pino } from 'pino';

export type { Logger };

export interface CreateLoggerOptions {
  /** Service name attached to every log line (e.g. 'public-api'). */
  name: string;
  /** Defaults to 'info'. Node apps pass this from their config. */
  level?: LoggerOptions['level'];
  pretty?: boolean;
  /** Pretty output only: print each request's `req` and `res` in full rather than one summary
   * line. JSON output always carries them. */
  requestDetails?: boolean;
}

/** `method url status time`, appended to the message of request lines only. */
const requestSummary =
  '{msg}{if req.method} {req.method} {req.url}{end}{if res.statusCode} {res.statusCode} {responseTime}ms{end}';

const prettyOptions = { colorize: true, translateTime: 'SYS:HH:MM:ss.l' };

/**
 * Local development only — the guards keep a stray pretty flag from resolving pino-pretty
 * where it is absent (a devDependency, not in production installs; never in the browser).
 */
function prettyTransport(
  pretty: boolean | undefined,
  requestDetails: boolean | undefined,
): LoggerOptions['transport'] {
  // `process` is undefined in the browser bundles used by the web apps.
  const isNodeRuntime = typeof process !== 'undefined' && process.versions?.node !== undefined;
  if (!pretty || !isNodeRuntime || process.env.NODE_ENV === 'production') {
    return undefined;
  }

  return {
    target: 'pino-pretty',
    options: requestDetails
      ? { ...prettyOptions, ignore: 'pid,hostname' }
      : {
          ...prettyOptions,
          ignore: 'pid,hostname,req,res,responseTime',
          messageFormat: requestSummary,
        },
  };
}

/**
 * The single shared entry point for logging across all four apps — Node services and browser
 * bundles alike (pino resolves to its browser build under a bundler). This package never
 * reads app configuration itself: level and pretty flow in from each app.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const loggerOptions: LoggerOptions = {
    name: options.name,
    level: options.level ?? 'info',
  };

  const transport = prettyTransport(options.pretty, options.requestDetails);
  if (transport !== undefined) {
    loggerOptions.transport = transport;
  }

  return pino(loggerOptions);
}
