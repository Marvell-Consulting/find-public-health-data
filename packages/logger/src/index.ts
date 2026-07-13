import { type Logger, type LoggerOptions, pino } from 'pino';

export type { Logger };

export interface CreateLoggerOptions {
  /** Service name attached to every log line (e.g. 'public-api'). */
  name: string;
  /** Log level. Defaults to the LOG_LEVEL environment variable on Node, otherwise 'info'. */
  level?: LoggerOptions['level'];
}

function resolveLevel(explicit: LoggerOptions['level']): NonNullable<LoggerOptions['level']> {
  if (explicit !== undefined) {
    return explicit;
  }

  // `process` is undefined in the browser bundles used by the web apps.
  if (typeof process !== 'undefined' && process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }

  return 'info';
}

/**
 * Human-readable pretty-printing, enabled only in a non-production Node runtime that opts in via
 * LOG_PRETTY. pino-pretty is a devDependency, so it is absent from a production install (e.g.
 * `pnpm install --prod`); the NODE_ENV check means a stray LOG_PRETTY there cannot make pino try
 * to resolve a missing module at startup. The browser never reaches this (no Node runtime).
 * Returns undefined when pretty-printing should not apply.
 */
function prettyTransport(): LoggerOptions['transport'] {
  const isNodeRuntime = typeof process !== 'undefined' && process.versions?.node !== undefined;
  if (!isNodeRuntime || process.env.NODE_ENV === 'production' || !process.env.LOG_PRETTY) {
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
 * Create a pino logger. The single shared entry point for logging across all four apps —
 * Node services and browser bundles alike (pino resolves to its browser build under a bundler).
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const loggerOptions: LoggerOptions = {
    name: options.name,
    level: resolveLevel(options.level),
  };

  const transport = prettyTransport();
  if (transport !== undefined) {
    loggerOptions.transport = transport;
  }

  return pino(loggerOptions);
}
