import type { Logger } from '@fphd/logger';

interface ServerLoggingOptions {
  port: number;
  onShutdown?: (() => void | Promise<void>) | undefined;
}

interface ServerLogging {
  onListening: () => void;
  onShutdown: (signal: NodeJS.Signals) => Promise<void>;
  onForcedClose: () => void;
  onError: (error: unknown) => void;
}

/** The lifecycle callbacks, identical in all four apps. Nothing here names the app — the logger
 * already binds that to every line. */
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
