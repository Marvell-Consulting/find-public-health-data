import { type Logger, type LoggerOptions, pino } from 'pino';

export type { Logger };

export interface CreateLoggerOptions {
  /** Service name attached to every log line (e.g. 'public-api'). */
  name: string;
  /** Defaults to 'info'. Node apps pass this from their config. */
  level?: LoggerOptions['level'];
  pretty?: boolean;
}

/**
 * Local development only — the guards keep a stray pretty flag from resolving pino-pretty
 * where it is absent (a devDependency, not in production installs; never in the browser).
 */
function prettyTransport(pretty: boolean | undefined): LoggerOptions['transport'] {
  // `process` is undefined in the browser bundles used by the web apps.
  const isNodeRuntime = typeof process !== 'undefined' && process.versions?.node !== undefined;
  if (!pretty || !isNodeRuntime || process.env.NODE_ENV === 'production') {
    return undefined;
  }

  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname',
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

  const transport = prettyTransport(options.pretty);
  if (transport !== undefined) {
    loggerOptions.transport = transport;
  }

  return pino(loggerOptions);
}
