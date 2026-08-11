import type { Server } from 'node:http';

import gracefulShutdown from 'http-graceful-shutdown';

/**
 * The budget for a whole stop, drain included, so this number is directly comparable to the
 * platform's grace period rather than being one term of a sum. Container Apps allows 30 seconds
 * by default (`terminationGracePeriodSeconds`, raisable to an hour), and a shutdown that outlives
 * the grace period is indistinguishable from one that never started.
 */
const DEFAULT_GRACE_PERIOD_MS = 25_000;

/**
 * Held back from the phases that run before cleanup. Closing a pool takes milliseconds, but it
 * is the phase that releases the handles keeping the process alive, so a slow drain or a hung
 * request must not be able to squeeze it down to nothing. Capped as a share of the budget as
 * well, so a deliberately short grace period shortens the reserve rather than being consumed
 * by it.
 */
const CLEANUP_RESERVE_MS = 2_000;
const CLEANUP_RESERVE_SHARE = 0.2;

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

export interface ShutdownOptions {
  /**
   * The whole stop, drain included, must fit in this. Keep it under the platform's grace
   * period: whatever is unfinished when it expires is destroyed rather than waited for.
   */
  gracePeriodMs?: number | undefined;
  /**
   * How long to keep serving after the signal, before closing anything. Zero on a developer
   * machine, where nothing is routing to the process and the delay would just make Ctrl-C slow.
   */
  drainDelayMs?: number | undefined;
  /**
   * Runs as the drain begins — this is where readiness starts failing, so the ingress stops
   * routing to a replica that is still perfectly able to serve what it has already been sent.
   */
  onDraining?: (() => void) | undefined;
  /**
   * Runs when the budget expired with requests still in flight, which are then destroyed.
   * Separate from `onError` because it reports a stop that had to cut work short rather than one
   * that failed, so it leaves the exit code alone — but it is worth a warning either way, since
   * under normal load nothing should still be running when the budget runs out.
   */
  onForcedClose?: (() => void) | undefined;
  /**
   * Runs once the server has stopped serving, before the process exits — close database
   * pools and other handles here. Without it a pool keeps the event loop alive and the
   * platform has to SIGKILL a process that has, in every sense that matters, finished. It
   * runs even when the server failed to close, because those handles need releasing either way.
   */
  onShutdown?: ((signal: NodeJS.Signals) => void | Promise<void>) | undefined;
  /**
   * Reports a stop that did not go to plan. This package logs nothing itself, so without this
   * a failed shutdown is a non-zero exit code and no explanation of it anywhere.
   */
  onError?: ((error: unknown) => void) | undefined;
}

/**
 * The first phase of a stop: still listening and still serving, but every response now carries
 * `Connection: close`, so a client retires its own pooled socket instead of having it destroyed
 * underneath a request it had already written. `onDraining` fires first: readiness fails, the
 * ingress stops routing here, and by the time anything closes there is little left to race with.
 *
 * Ours rather than the library's, for two reasons. It sets the header only once its own shutdown
 * has begun, which is the moment it also stops listening, so there is no window in which a client
 * is told to retire a connection while the server is still there to serve it. And it registers
 * with `server.on('request')`, which appends: Express is already the server's request listener,
 * so for any synchronous response the headers are sent before the library's listener runs and its
 * `!res.headersSent` guard silently skips the header. Prepending is what makes it reliable.
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
 * `onShutdown` is caller code holding caller handles: postgres's `end()` waits for every
 * connection to drain, and one wedged on a half-open socket never returns. By the time it runs
 * the signal handlers have already replaced the default terminate action, so an unbounded wait
 * here is a process that ignores SIGTERM and SIGINT until the platform kills it. The library's
 * own `onShutdown` hook is unbounded and is skipped entirely when the close failed, so cleanup
 * is run here instead of through it.
 *
 * The timer is deliberately not `unref`'d: it is the only thing left guaranteeing the stop
 * reaches an exit code once cleanup has stopped making progress.
 */
function withDeadline(work: Promise<void>, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const expiry = setTimeout(
      () => reject(new Error(`Shutdown cleanup did not finish within ${timeoutMs}ms`)),
      timeoutMs,
    );

    void work.then(resolve, reject).finally(() => clearTimeout(expiry));
  });
}

/**
 * The shutdown itself, separated from the signal wiring so it can be tested without
 * signalling the test runner's own process. Resolves to the exit code the process should
 * use; safe to call more than once, because a platform that has sent SIGTERM will often
 * send it again if the process is slow to go.
 *
 * The close phase is `http-graceful-shutdown`: it tracks connections, destroys each one as its
 * response finishes, refuses new ones, and destroys whatever is left at its timeout. The phases
 * around it are ours, because the library bounds only that middle phase — the drain would be
 * added to its timeout and cleanup would be unbounded, so a stop would have no single ceiling.
 * Here they share one deadline and the worst case is the grace period itself.
 *
 * **Call this before the server takes any traffic.** The library learns about connections from a
 * `connection` listener attached here, so a socket that already exists is invisible to it: it is
 * never destroyed, and the close waits on it until the grace period runs out. Every entrypoint
 * satisfies this by calling `installShutdownHandlers` in the same tick as `listen`.
 */
export function createShutdownHandler(
  server: Server,
  {
    gracePeriodMs = DEFAULT_GRACE_PERIOD_MS,
    drainDelayMs = 0,
    onDraining,
    onForcedClose,
    onShutdown,
    onError,
  }: ShutdownOptions = {},
): (signal: NodeJS.Signals) => Promise<number> {
  const reserve = Math.min(CLEANUP_RESERVE_MS, gracePeriodMs * CLEANUP_RESERVE_SHARE);
  const closeTimeoutMs = Math.max(0, gracePeriodMs - drainDelayMs - reserve);

  const closeHttpServer = gracefulShutdown(server, {
    // No signal handlers of its own. Ours memoize the in-flight stop, where a repeated signal
    // here would `process.exit(1)` and lose the cleanup that releases the pool — and a platform
    // that has sent SIGTERM sends it again when the process is slow to go.
    signals: '',
    // The exit code is decided below, once cleanup has had its turn.
    forceExit: false,
    // Its development mode exits immediately, before the Vite server is closed.
    development: false,
    timeout: closeTimeoutMs,
  });

  let inProgress: Promise<number> | undefined;

  return (signal) => {
    inProgress ??= (async () => {
      const expiresAt = Date.now() + gracePeriodMs;
      const remaining = () => Math.max(0, expiresAt - Date.now());
      /** What a phase running before cleanup may spend, leaving cleanup its reserve. */
      const spendable = () => Math.max(0, remaining() - reserve);
      const failures: unknown[] = [];

      try {
        await drainServer(server, Math.min(drainDelayMs, spendable()), onDraining);
      } catch (error) {
        failures.push(error);
      }

      // The library destroys what is still in flight at its timeout but only logs through
      // `debug`, so the warning is raised alongside it. Cleared when the close wins the race,
      // which is every stop that did not have to cut work short.
      const forced = setTimeout(() => onForcedClose?.(), closeTimeoutMs);
      forced.unref();

      try {
        await closeHttpServer();
      } catch (error) {
        failures.push(error);
      } finally {
        clearTimeout(forced);
      }

      try {
        if (onShutdown !== undefined) {
          await withDeadline(Promise.resolve(onShutdown(signal)), remaining());
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
      // The rejection branch covers a throwing `onError`: the process exits either way.
      void shutdown(received).then(
        (code) => process.exit(code),
        () => process.exit(1),
      );
    });
  }
}
