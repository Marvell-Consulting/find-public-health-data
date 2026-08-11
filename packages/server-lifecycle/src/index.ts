import type { Server, ServerResponse } from 'node:http';

import gracefulShutdown from 'http-graceful-shutdown';

/**
 * Held back from the phases before it, because cleanup releases the handles keeping the process
 * alive. Capped as a share of the budget so a short grace period shortens the reserve rather
 * than being eaten by it.
 */
const CLEANUP_RESERVE_MS = 2_000;
const CLEANUP_RESERVE_SHARE = 0.2;

/**
 * The library polls in steps of this and reads a falsy timeout as "destroy everything now", so
 * it is both the smallest close window worth asking for and the margin a backstop of ours needs
 * to land after the library's own deadline.
 */
const CLOSE_POLL_STEP_MS = 250;

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

export interface ShutdownOptions {
  /** The whole stop, drain included. Keep it under the platform's own grace period. */
  gracePeriodMs: number;
  /** How long to keep serving after the signal, before closing anything. */
  drainDelayMs: number;
  /** Runs as the drain begins, so readiness fails before anything stops listening. */
  onDraining?: (() => void) | undefined;
  /**
   * Runs when the stop cut work short. Separate from `onError`, and leaves the exit code alone,
   * because such a stop did not fail.
   */
  onForcedClose?: (() => void) | undefined;
  /**
   * Close database pools and other handles here — a pool left open keeps the event loop alive
   * and the platform has to kill a process that has finished. Runs even when the close failed,
   * because those handles need releasing either way.
   */
  onShutdown?: ((signal: NodeJS.Signals) => void | Promise<void>) | undefined;
  /** Reports a stop that failed; this package logs nothing itself. */
  onError?: ((error: unknown) => void) | undefined;
}

/**
 * The first phase: still listening and still serving, but every response now carries
 * `Connection: close`, so a client retires its own pooled socket rather than having it destroyed
 * underneath a request it had already written.
 *
 * Ours rather than the library's, which sets the header only once it has also stopped listening,
 * and registers it with `server.on('request')` — appending after Express, so a synchronous
 * response has its headers sent before the library's `!res.headersSent` guard sees it.
 */
export function drainServer(
  server: Server,
  delayMs: number,
  onDraining?: (() => void) | undefined,
): Promise<void> {
  server.prependListener('request', (_request, response) => {
    response.setHeader('Connection', 'close');
  });

  onDraining?.();

  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Lets the close report what it cut short rather than guess at it. A timer racing the library's
 * deadline both misses forced closes and warns about stops that destroyed nothing, and a
 * destroyed response has not yet had its own `close` event when the close resolves.
 */
function trackOpenResponses(server: Server): () => ServerResponse[] {
  const open = new Set<ServerResponse>();

  server.prependListener('request', (_request, response) => {
    open.add(response);
    response.once('close', () => open.delete(response));
  });

  return () => [...open];
}

/** The timer is not `unref`'d: it is the only thing left guaranteeing an exit code. */
function withDeadline(work: Promise<void>, timeoutMs: number, phase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const expiry = setTimeout(
      () => reject(new Error(`Shutdown ${phase} did not finish within ${timeoutMs}ms`)),
      timeoutMs,
    );

    void work.then(resolve, reject).finally(() => clearTimeout(expiry));
  });
}

/**
 * Drain, close, cleanup, sharing one budget — the library bounds only the close, so a stop
 * through it alone would have no single ceiling to compare against the platform's grace period.
 * Resolves to the exit code the process should use, and is safe to call more than once.
 *
 * Separated from the signal wiring so a stop can be tested without signalling the test runner's
 * own process. **Call it before the server takes any traffic**: the library learns about
 * connections from a listener attached here, so a socket that already exists is invisible to it.
 */
export function createShutdownHandler(
  server: Server,
  { gracePeriodMs, drainDelayMs, onDraining, onForcedClose, onShutdown, onError }: ShutdownOptions,
): (signal: NodeJS.Signals) => Promise<number> {
  const reserve = Math.min(CLEANUP_RESERVE_MS, gracePeriodMs * CLEANUP_RESERVE_SHARE);
  // The close takes its share before the drain does: left as the remainder it reaches zero, and
  // a zero timeout is the library destroying every live request the moment the drain ends.
  const closeTimeoutMs = Math.max(CLOSE_POLL_STEP_MS, gracePeriodMs - drainDelayMs - reserve);
  const drainMs = Math.max(0, Math.min(drainDelayMs, gracePeriodMs - reserve - closeTimeoutMs));

  const openResponses = trackOpenResponses(server);

  const closeHttpServer = gracefulShutdown(server, {
    // No handlers of its own: a repeated signal there is a bare `process.exit(1)` that would
    // lose the cleanup releasing the pool. Ours memoize the in-flight stop instead.
    signals: '',
    // The exit code is decided below, once cleanup has had its turn.
    forceExit: false,
    // Its development mode exits before the Vite server is closed.
    development: false,
    timeout: closeTimeoutMs,
  });

  let inProgress: Promise<number> | undefined;

  return (signal) => {
    inProgress ??= (async () => {
      const expiresAt = Date.now() + gracePeriodMs;
      const remaining = () => Math.max(0, expiresAt - Date.now());
      const failures: unknown[] = [];

      try {
        await drainServer(server, drainMs, onDraining);
      } catch (error) {
        failures.push(error);
      }

      try {
        // A backstop, one poll step behind the library's deadline so it lands after it: the
        // library's timeout covers its wait for idle connections, not the close itself, which
        // goes on waiting for any socket it never saw. Unbounded, that is a process that has
        // replaced the default signal handlers and now ignores every stop until it is killed.
        await withDeadline(closeHttpServer(), closeTimeoutMs + CLOSE_POLL_STEP_MS, 'close');
      } catch (error) {
        failures.push(error);
        server.closeAllConnections();
      }

      if (openResponses().some((response) => !response.writableFinished)) onForcedClose?.();

      try {
        // Floored at the reserve the phases above were planned to leave.
        if (onShutdown !== undefined) {
          const cleanup = Promise.resolve(onShutdown(signal));
          await withDeadline(cleanup, Math.max(remaining(), reserve), 'cleanup');
        }
      } catch (error) {
        failures.push(error);
      }

      for (const failure of failures) onError?.(failure);
      return failures.length === 0 ? 0 : 1;
    })();

    return inProgress;
  };
}

/**
 * The kernel discards a default-action signal sent to PID 1 unless the process installed a
 * handler, so without this a containerised app ignores the stop and waits to be killed.
 * `process.exit` rather than letting the loop drain: the server is closed and cleanup has run,
 * so anything still holding the loop open is what would delay the exit.
 */
export function installShutdownHandlers(server: Server, options: ShutdownOptions): void {
  const shutdown = createShutdownHandler(server, options);

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, (received) => {
      // The rejection branch covers a throwing `onError`: the process exits either way.
      void shutdown(received).then(
        (code) => process.exit(code),
        () => process.exit(1),
      );
    });
  }
}
