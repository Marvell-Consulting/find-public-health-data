import type { Server } from 'node:http';

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

/** A socket falling idle mid-close then costs a tenth of a second rather than five. */
const IDLE_SWEEP_INTERVAL_MS = 100;

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
   * Runs when the grace period expired with requests still in flight, which are then destroyed.
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
   * Reports a stop that did not go to plan. This package logs nothing itself — it has no
   * dependencies beyond `node:http` — so without this a failed shutdown is a non-zero exit
   * code and no explanation of it anywhere.
   */
  onError?: ((error: unknown) => void) | undefined;
}

/**
 * The first phase of a stop: still listening and still serving, but every response now carries
 * `Connection: close`, so a client retires its own pooled socket instead of having it destroyed
 * underneath a request it had already written. Destroying a socket with an unparsed request in
 * its receive buffer is a TCP reset, and no sweep policy avoids that — retiring the connection
 * through HTTP does. `onDraining` fires first: readiness fails, the ingress stops routing here,
 * and by the time anything closes there is little left to race with.
 *
 * The listener is prepended because Express is already the server's `request` listener, and a
 * synchronous handler would otherwise have sent the headers before this ran.
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
 * Stops accepting connections, then waits for in-flight requests to finish.
 *
 * `close` sweeps idle keep-alive sockets, but only once, as it is called. The interval repeats
 * that sweep: a socket whose request completes *during* the close is carrying no work from that
 * moment on, and would otherwise hold the close open for the entire keep-alive timeout. The
 * timeout then destroys whatever is genuinely still mid-request, so one hung handler cannot
 * stall the shutdown indefinitely.
 *
 * A request written to a keep-alive socket but not yet parsed counts as idle and is reset rather
 * than served. Node's own `close` does the same, and avoiding it would mean draining with
 * `Connection: close` instead of destroying idle sockets.
 */
export function shutdownServer(
  server: Server,
  timeoutMs = DEFAULT_GRACE_PERIOD_MS,
  onForcedClose?: (() => void) | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sweepIdle = setInterval(() => server.closeIdleConnections(), IDLE_SWEEP_INTERVAL_MS);
    // Only ever reached with work still in flight: a close that finishes first clears it.
    const forceClose = setTimeout(() => {
      onForcedClose?.();
      server.closeAllConnections();
    }, timeoutMs);
    // Nothing should be kept alive merely because a shutdown timer is pending.
    sweepIdle.unref();
    forceClose.unref();

    server.close((error) => {
      clearInterval(sweepIdle);
      clearTimeout(forceClose);
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}

/**
 * `onShutdown` is caller code holding caller handles: postgres's `end()` waits for every
 * connection to drain, and one wedged on a half-open socket never returns. By the time it runs
 * the signal handlers have already replaced the default terminate action, so an unbounded wait
 * here is a process that ignores SIGTERM and SIGINT until the platform kills it.
 *
 * The timer is deliberately not `unref`'d, unlike the ones in `shutdownServer`: it is the only
 * thing left guaranteeing the stop reaches an exit code once cleanup has stopped making progress.
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
 * The phases share one deadline rather than holding a timeout each, so the worst case is the
 * grace period itself and there is no sum to get wrong when tuning it.
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
  let inProgress: Promise<number> | undefined;

  return (signal) => {
    inProgress ??= (async () => {
      const expiresAt = Date.now() + gracePeriodMs;
      const reserve = Math.min(CLEANUP_RESERVE_MS, gracePeriodMs * CLEANUP_RESERVE_SHARE);
      const remaining = () => Math.max(0, expiresAt - Date.now());
      /** What a phase running before cleanup may spend, leaving cleanup its reserve. */
      const spendable = () => Math.max(0, remaining() - reserve);
      const failures: unknown[] = [];

      try {
        await drainServer(server, Math.min(drainDelayMs, spendable()), onDraining);
      } catch (error) {
        failures.push(error);
      }

      try {
        await shutdownServer(server, spendable(), onForcedClose);
      } catch (error) {
        failures.push(error);
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
