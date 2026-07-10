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
 * Create a pino logger. The single shared entry point for logging across all four apps —
 * Node services and browser bundles alike (pino resolves to its browser build under a bundler).
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  return pino({
    name: options.name,
    level: resolveLevel(options.level),
  });
}
