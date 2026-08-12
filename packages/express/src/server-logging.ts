import type { Logger } from '@fphd/logger';

interface ServerLoggingOptions {
  port: number;
  /** Released before the process exits — the database pool, or the dev-mode Vite server. */
  onShutdown?: (() => void | Promise<void>) | undefined;
}

interface ServerLogging {
  onListening: () => void;
  onShutdown: (signal: NodeJS.Signals) => Promise<void>;
  onForcedClose: () => void;
  onError: (error: unknown) => void;
}

/**
 * The reporting side of a server's lifecycle, which is the same in all four apps. Nothing here
 * names the app: the logger already binds its name to every line, and four copies differing
 * only in that string are four places for a level or a message to drift.
 */
export function serverLogging(
  logger: Logger,
  { port, onShutdown }: ServerLoggingOptions,
): ServerLogging {
  return {
    onListening: () => logger.info({ port }, 'Listening'),
    onShutdown: async (signal) => {
      await onShutdown?.();
      logger.info({ signal }, 'Stopped');
    },
    onForcedClose: () => logger.warn('Ran out of time to close, so requests were cut short'),
    onError: (error) => logger.error({ err: error }, 'Did not stop cleanly'),
  };
}
