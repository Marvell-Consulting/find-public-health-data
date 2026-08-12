import type { Server } from 'node:http';

import gracefulShutdown from 'http-graceful-shutdown';

/**
 * Held back from the close, because cleanup releases the handles keeping the process alive. Capped
 * as a share of the budget so a short grace period shortens the reserve rather than being eaten
 * by it.
 */
const CLEANUP_RESERVE_MS = 2_000;
const CLEANUP_RESERVE_SHARE = 0.2;

/**
 * The library polls in steps of this and reads a falsy timeout as "destroy everything now", so it
 * is the smallest window worth asking it for.
 */
const CLOSE_POLL_STEP_MS = 250;

/**
 * Held back from what the library is told, because it counts its timeout in recursive 250ms hops
 * and every hop slips by however late the event loop is — measured in seconds, not steps, on a
 * loaded process. A share rather than a constant, since the drift grows with the hop count.
 */
const CLOSE_DRIFT_SHARE = 0.2;

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

export interface ShutdownOptions {
  /** The whole stop, drain included. Keep it under the platform's own grace period. */
  gracePeriodMs: number;
  /** How long to keep serving after the signal, before closing anything. */
  drainDelayMs: number;
  /** Runs as the drain begins, so readiness fails before anything stops listening. */
  onDraining?: (() => void) | undefined;
  /**
   * Runs when the budget ran out and the close was forced. Separate from `onError`, and leaves the
   * exit code alone, because a stop that spent its budget did not fail.
   */
  onForcedClose?: (() => void) | undefined;
  /**
   * Close database pools and other handles here — a pool left open keeps the event loop alive and
   * the platform has to kill a process that has finished. Runs even when the close failed, because
   * those handles need releasing either way.
   */
  onShutdown?: ((signal: NodeJS.Signals) => void | Promise<void>) | undefined;
  /** Reports a stop that failed; this module logs nothing itself. */
  onError?: ((error: unknown) => void) | undefined;
}

interface PhaseBudgets {
  drainMs: number;
  /** The close phase's share of the budget. */
  closeMs: number;
  /** What the library is told, kept under `closeMs` so its poll loop can slip and still finish. */
  closeTimeoutMs: number;
  reserveMs: number;
}

/**
 * Divides one budget between the phases. The close takes its share before the drain does: left as
 * the remainder it reaches zero, and a zero timeout is the library destroying every live request
 * the moment the drain ends.
 */
export function phaseBudgets(gracePeriodMs: number, drainDelayMs: number): PhaseBudgets {
  const reserveMs = Math.min(CLEANUP_RESERVE_MS, gracePeriodMs * CLEANUP_RESERVE_SHARE);
  const closeMs = Math.max(CLOSE_POLL_STEP_MS, gracePeriodMs - drainDelayMs - reserveMs);
  const closeTimeoutMs = Math.max(CLOSE_POLL_STEP_MS, closeMs * (1 - CLOSE_DRIFT_SHARE));
  const drainMs = Math.max(0, Math.min(drainDelayMs, gracePeriodMs - reserveMs - closeMs));

  return { drainMs, closeMs, closeTimeoutMs, reserveMs };
}

/** Distinguishes a phase that ran out of budget from one that failed. */
class DeadlineExceeded extends Error {}

/** The timer is not `unref`'d: it is the only thing left guaranteeing an exit code. */
function withDeadline(work: Promise<void>, timeoutMs: number, phase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const expiry = setTimeout(
      () => reject(new DeadlineExceeded(`Shutdown ${phase} did not finish within ${timeoutMs}ms`)),
      timeoutMs,
    );

    void work.then(resolve, reject).finally(() => clearTimeout(expiry));
  });
}

/**
 * Drain, close and cleanup sharing one budget. The library's own timeout bounds the close alone
 * and leaves its `preShutdown` and `onShutdown` hooks outside it, so a stop through it unaided
 * would be a sum rather than the single ceiling the platform's grace period has to be compared
 * against. Resolves to the exit code the process should use, and is safe to call more than once.
 *
 * Separated from the signal wiring so a stop can be tested without signalling the test runner's
 * own process. **Call it before the server takes any traffic**: the library learns about
 * connections from a listener attached here, so a socket that already exists is invisible to it.
 */
export function createShutdownHandler(
  server: Server,
  { gracePeriodMs, drainDelayMs, onDraining, onForcedClose, onShutdown, onError }: ShutdownOptions,
): (signal: NodeJS.Signals) => Promise<number> {
  const { drainMs, closeTimeoutMs, reserveMs } = phaseBudgets(gracePeriodMs, drainDelayMs);
  let drainFailure: unknown;

  const closeHttpServer = gracefulShutdown(server, {
    // No handlers of its own: a repeated signal there is a bare `process.exit(1)` that would lose
    // the cleanup releasing the pool. Ours memoize the in-flight stop instead.
    signals: '',
    // The exit code is decided below, once cleanup has had its turn.
    forceExit: false,
    // Its development mode exits before the Vite server is closed.
    development: false,
    timeout: closeTimeoutMs,
    // The drain: still listening and still serving, so the ingress has time to stop routing here
    // before anything stops accepting.
    preShutdown: async () => {
      try {
        onDraining?.();
      } catch (error) {
        // Recorded rather than rethrown: a rejected `preShutdown` short-circuits the library
        // before it closes the server, so the listener would be left open.
        drainFailure = error;
      }
      await new Promise((resolve) => setTimeout(resolve, drainMs));
    },
  });

  let inProgress: Promise<number> | undefined;

  return (signal) => {
    inProgress ??= (async () => {
      const expiresAt = Date.now() + gracePeriodMs;
      const remaining = () => Math.max(0, expiresAt - Date.now());
      const failures: unknown[] = [];

      try {
        // A backstop, given everything left except the reserve: the library's timeout covers its
        // wait for idle connections, not the close itself, which goes on waiting for any socket it
        // never saw. Unbounded, that is a process which has replaced the default signal handlers
        // and now ignores every stop until it is killed.
        const closeBy = Math.max(CLOSE_POLL_STEP_MS, remaining() - reserveMs);
        await withDeadline(closeHttpServer(), closeBy, 'close');
      } catch (error) {
        server.closeAllConnections();
        // Spending the budget is not failing. The library counts its own timeout in 250ms hops
        // that slip with the event loop, so under load it can overrun by seconds and land here
        // having done nothing wrong.
        if (error instanceof DeadlineExceeded) onForcedClose?.();
        else failures.push(error);
      }

      if (drainFailure !== undefined) failures.push(drainFailure);

      if (onShutdown !== undefined) {
        try {
          // Floored at the reserve the phases above were planned to leave.
          const cleanup = Promise.resolve(onShutdown(signal));
          await withDeadline(cleanup, Math.max(remaining(), reserveMs), 'cleanup');
        } catch (error) {
          failures.push(error);
        }
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
 * `process.exit` rather than letting the loop drain: the server is closed and cleanup has run, so
 * anything still holding the loop open is what would delay the exit.
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
