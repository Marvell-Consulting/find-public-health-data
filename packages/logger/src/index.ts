import { type Logger, type LoggerOptions, pino } from 'pino';

export type { Logger };

export interface CreateLoggerOptions {
  /** Service name attached to every log line (e.g. 'public-api'). */
  name: string;
  /** Log level. Defaults to 'info'. Node apps pass this from their config. */
  level?: LoggerOptions['level'];
  /**
   * Human-readable pretty-printing. Defaults to false. Node apps pass this from their config;
   * it has no effect in the browser or in a production Node runtime.
   */
  pretty?: boolean;
}

/**
 * The pino-pretty transport, applied only in a non-production Node runtime. pino-pretty is a
 * devDependency, so it is absent from a production install (e.g. `pnpm install --prod`); the
 * NODE_ENV check means a stray pretty flag there cannot make pino try to resolve a missing
 * module at startup. The browser never reaches this (no Node runtime). Returns undefined when
 * pretty-printing should not apply.
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
 * Create a pino logger. The single shared entry point for logging across all four apps —
 * Node services and browser bundles alike (pino resolves to its browser build under a bundler).
 * This package never reads app configuration itself: level and pretty flow in from each app
 * (Node apps source them from their validated config).
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
