import type { Server } from 'node:http';

/**
 * Long enough for a slow request to finish, comfortably shorter than the platform's grace
 * period before SIGKILL — Container Apps allows 30 seconds by default, and a shutdown that
 * outlives it is indistinguishable from one that never started.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

export interface ShutdownOptions {
  timeoutMs?: number;
  /**
   * Runs once the server has stopped serving, before the process exits — close database
   * pools and other handles here. Without it a pool keeps the event loop alive and the
   * platform has to SIGKILL a process that has, in every sense that matters, finished.
   */
  onShutdown?: (signal: NodeJS.Signals) => void | Promise<void>;
}

/**
 * Stops accepting connections, then waits for in-flight requests to finish.
 *
 * `closeIdleConnections` is what makes that terminate promptly: `close` waits for every
 * socket, and a keep-alive socket sitting between requests is carrying no work but would
 * hold it open until the timeout anyway. The timeout then destroys whatever is genuinely
 * still mid-request, so a hung handler cannot stall the shutdown indefinitely.
 */
export function shutdownServer(server: Server, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const forceClose = setTimeout(() => server.closeAllConnections(), timeoutMs);
    // Nothing should be kept alive merely because a shutdown timer is pending.
    forceClose.unref();

    server.close((error) => {
      clearTimeout(forceClose);
      if (error === undefined) resolve();
      else reject(error);
    });

    server.closeIdleConnections();
  });
}

/**
 * The shutdown itself, separated from the signal wiring so it can be tested without
 * signalling the test runner's own process. Resolves to the exit code the process should
 * use; safe to call more than once, because a platform that has sent SIGTERM will often
 * send it again if the process is slow to go.
 */
export function createShutdownHandler(
  server: Server,
  { timeoutMs, onShutdown }: ShutdownOptions = {},
): (signal: NodeJS.Signals) => Promise<number> {
  let inProgress: Promise<number> | undefined;

  return (signal) => {
    inProgress ??= (async () => {
      try {
        await shutdownServer(server, timeoutMs);
        await onShutdown?.(signal);
        return 0;
      } catch {
        return 1;
      }
    })();

    return inProgress;
  };
}

/**
 * Node installs no SIGTERM handler of its own, and the kernel discards a default-action
 * signal sent to PID 1 unless the process installed one — so without this a containerised
 * app ignores the stop entirely and waits to be killed. `process.exit` rather than letting
 * the loop drain: by this point the server is closed and `onShutdown` has run, and anything
 * still holding the loop open is exactly what would delay the exit.
 */
export function installShutdownHandlers(server: Server, options: ShutdownOptions = {}): void {
  const shutdown = createShutdownHandler(server, options);

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, (received) => {
      void shutdown(received).then((code) => process.exit(code));
    });
  }
}
