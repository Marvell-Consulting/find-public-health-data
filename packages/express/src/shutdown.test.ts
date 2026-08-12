import { Agent, createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShutdownHandler, phaseBudgets, type ShutdownOptions } from './shutdown.js';

const defaults = { gracePeriodMs: 5_000, drainDelayMs: 0 };

/**
 * Built before any traffic, as every real entrypoint does: the library learns about connections
 * from a listener it attaches here, so one created later cannot see the sockets already open.
 */
function shutdownHandler(server: Server, options: Partial<ShutdownOptions> = {}) {
  return createShutdownHandler(server, { ...defaults, onError: () => {}, ...options });
}

type Handler = Parameters<typeof createServer>[1];

let running: Server | undefined;

async function startServer(handler: Handler): Promise<{ server: Server; url: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  running = server;

  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

/**
 * `agent: false` forces a brand-new socket. `fetch` pools connections, so a refusal it reported
 * could be a pooled socket the server had already closed rather than the listener refusing it.
 */
function requestOnNewConnection(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { agent: false }, () => resolve());
    outgoing.on('error', reject);
    outgoing.end();
  });
}

/** A keep-alive socket the test owns, so it stays open and idle once the response has ended. */
function keepAliveRequest(url: string, agent: Agent): Promise<void> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { agent }, (response) => {
      response.resume();
      response.on('end', () => resolve());
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(async () => {
  if (running?.listening === true) {
    running.closeAllConnections();
    await new Promise((resolve) => running?.close(resolve));
  }
  running = undefined;
});

describe('phaseBudgets', () => {
  it('leaves the close a window to work with when the drain would fill the budget', () => {
    const { drainMs, closeTimeoutMs } = phaseBudgets(600, 600);

    // A zero timeout is the library destroying every live request the moment the drain ends, so
    // the drain gives way rather than the close being left the remainder.
    expect(closeTimeoutMs).toBeGreaterThan(0);
    expect(drainMs).toBeLessThan(600);
  });

  it('fits all three phases inside the grace period', () => {
    for (const [gracePeriodMs, drainDelayMs] of [
      [25_000, 5_000],
      [5_000, 0],
      [1_000, 5_000],
      [600, 600],
    ] as const) {
      const { drainMs, closeMs, reserveMs } = phaseBudgets(gracePeriodMs, drainDelayMs);

      expect(drainMs + closeMs + reserveMs).toBeLessThanOrEqual(gracePeriodMs);
      expect(drainMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('asks the library to finish early, so its poll loop can slip and still be in time', () => {
    // It counts its timeout in 250ms hops and each one slips by however late the event loop is,
    // which on a loaded process runs to seconds. Told the whole share, a close that succeeded
    // would trip the backstop and be reported as a stop that failed.
    const { closeMs, closeTimeoutMs } = phaseBudgets(25_000, 5_000);

    expect(closeTimeoutMs).toBeLessThan(closeMs);
    expect(closeMs - closeTimeoutMs).toBeGreaterThan(2_000);
  });

  it('shortens the reserve on a short grace period rather than spending the budget on it', () => {
    expect(phaseBudgets(25_000, 0).reserveMs).toBe(2_000);
    expect(phaseBudgets(1_000, 0).reserveMs).toBe(200);
  });
});

// What the library is relied on for. Tested rather than taken on trust, because the close is the
// half of a stop that a swap of implementation could quietly change.
describe('the close phase', () => {
  it('stops the server listening', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));

    await shutdownHandler(server)('SIGTERM');

    expect(server.listening).toBe(false);
  });

  it('lets an in-flight request finish before resolving', async () => {
    const reachedHandler = deferred();
    const releaseHandler = deferred();
    const { server, url } = await startServer(async (_request, response) => {
      reachedHandler.resolve();
      await releaseHandler.promise;
      response.end('finished');
    });
    const stop = shutdownHandler(server);

    const inFlight = fetch(`${url}/slow`);
    await reachedHandler.promise;

    const settled = vi.fn();
    const shutdown = stop('SIGTERM').then(settled);

    await delay(20);
    expect(settled).not.toHaveBeenCalled();

    releaseHandler.resolve();
    expect(await (await inFlight).text()).toBe('finished');
    await shutdown;
    expect(settled).toHaveBeenCalled();
  });

  it('refuses new connections while finishing the ones it has', async () => {
    const releaseHandler = deferred();
    const reachedHandler = deferred();
    const { server, url } = await startServer(async (_request, response) => {
      reachedHandler.resolve();
      await releaseHandler.promise;
      response.end('finished');
    });
    const stop = shutdownHandler(server);

    const settled = vi.fn();
    const inFlight = fetch(`${url}/slow`).finally(settled);
    await reachedHandler.promise;
    const shutdown = stop('SIGTERM');

    // Waited for rather than raced: until the listener has actually closed, a late connection
    // being accepted says nothing. Once it has, the request below can only be refused.
    await vi.waitFor(() => expect(server.listening).toBe(false));
    await expect(requestOnNewConnection(`${url}/late`)).rejects.toThrow();

    // The half that makes it a graceful close rather than a stop: the request already being
    // served is still open.
    expect(settled).not.toHaveBeenCalled();

    releaseHandler.resolve();
    expect(await (await inFlight).text()).toBe('finished');
    await shutdown;
  });

  it('does not wait out the timeout for a connection that falls idle mid-shutdown', async () => {
    const reachedHandler = deferred();
    const releaseHandler = deferred();
    const { server, url } = await startServer(async (_request, response) => {
      reachedHandler.resolve();
      await releaseHandler.promise;
      response.end('finished');
    });
    const agent = new Agent({ keepAlive: true });
    const stop = shutdownHandler(server);

    // The socket is busy when the shutdown starts and idle a moment later, so the single sweep
    // `close` performs as it is called cannot see it. Without the library destroying it as the
    // response finishes, this waits out Node's five-second keep-alive timeout.
    const inFlight = keepAliveRequest(`${url}/slow`, agent);
    await reachedHandler.promise;

    const started = Date.now();
    const shutdown = stop('SIGTERM');
    releaseHandler.resolve();
    await inFlight;
    await shutdown;

    expect(Date.now() - started).toBeLessThan(1_000);
    agent.destroy();
  });

  it('destroys a connection still mid-request once the timeout expires', async () => {
    const reachedHandler = deferred();
    const { server, url } = await startServer(() => {
      // Never responds: the handler a graceful shutdown must not wait on forever.
      reachedHandler.resolve();
    });

    const stop = shutdownHandler(server, { gracePeriodMs: 300 });

    const abandoned = fetch(`${url}/never`).catch((error: unknown) => error);
    await reachedHandler.promise;

    await stop('SIGTERM');

    expect(server.listening).toBe(false);
    expect(await abandoned).toBeInstanceOf(Error);
  });
});

describe('createShutdownHandler', () => {
  it('keeps serving while it drains, before anything stops listening', async () => {
    let served = 0;
    const { server, url } = await startServer((_request, response) => {
      served += 1;
      response.end('ok');
    });
    const shutdown = shutdownHandler(server, { drainDelayMs: 100 })('SIGTERM');

    expect(server.listening).toBe(true);
    expect(await (await fetch(`${url}/during`)).text()).toBe('ok');

    await shutdown;

    expect(served).toBe(1);
    expect(server.listening).toBe(false);
  });

  it('fails readiness as the drain starts, not once it is over', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const listeningWhenDraining = deferred<boolean>();
    const shutdown = shutdownHandler(server, {
      drainDelayMs: 20,
      onDraining: () => listeningWhenDraining.resolve(server.listening),
    });

    expect(await shutdown('SIGTERM')).toBe(0);
    expect(await listeningWhenDraining.promise).toBe(true);
    expect(server.listening).toBe(false);
  });

  it('closes the server even when the readiness flip throws', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const failure = new Error('readiness flip threw');
    const onShutdown = vi.fn();
    const onError = vi.fn();

    const exitCode = await shutdownHandler(server, {
      onDraining: () => {
        throw failure;
      },
      onShutdown,
      onError,
    })('SIGTERM');

    // A `preShutdown` that rejects short-circuits the library before it closes anything, so this
    // is reported and stepped over rather than thrown.
    expect(server.listening).toBe(false);
    expect(onShutdown).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(exitCode).toBe(1);
  });

  it('runs onShutdown after the server has closed, and reports success', async () => {
    const closedWhenCalled = deferred<boolean>();
    const { server } = await startServer((_request, response) => response.end('ok'));
    const shutdown = shutdownHandler(server, {
      onShutdown: () => closedWhenCalled.resolve(server.listening === false),
    });

    expect(await shutdown('SIGTERM')).toBe(0);
    expect(await closedWhenCalled.promise).toBe(true);
  });

  it('passes the signal through to onShutdown', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const onShutdown = vi.fn();

    await shutdownHandler(server, { onShutdown })('SIGINT');

    expect(onShutdown).toHaveBeenCalledWith('SIGINT');
  });

  it('reports failure when cleanup throws, rather than exiting as if it had worked', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const failure = new Error('pool refused to close');
    const onError = vi.fn();
    const shutdown = shutdownHandler(server, {
      onShutdown: () => {
        throw failure;
      },
      onError,
    });

    expect(await shutdown('SIGTERM')).toBe(1);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('still runs cleanup when the server itself fails to close', async () => {
    // Never listened, so `close` calls back with ERR_SERVER_NOT_RUNNING — the shape of a signal
    // landing in the startup window, where the pool still has to be released.
    const server = createServer();
    const onShutdown = vi.fn();
    const onError = vi.fn();

    const exitCode = await shutdownHandler(server, { onShutdown, onError })('SIGTERM');

    expect(exitCode).toBe(1);
    expect(onShutdown).toHaveBeenCalledWith('SIGTERM');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ERR_SERVER_NOT_RUNNING' }),
    );
  });

  it('gives up on cleanup that never finishes, rather than ignoring the signal for good', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const stuck = deferred();
    const onError = vi.fn();
    const shutdown = shutdownHandler(server, {
      onShutdown: () => stuck.promise,
      onError,
      gracePeriodMs: 50,
    });

    expect(await shutdown('SIGTERM')).toBe(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    stuck.resolve();
  });

  it('bounds a close that cannot finish, and still lets cleanup run', async () => {
    const reachedHandler = deferred();
    const { server, url } = await startServer(() => reachedHandler.resolve());
    const abandoned = fetch(`${url}/never`).catch((error: unknown) => error);
    await reachedHandler.promise;

    // The request above is already being served when the handler is built, so the library never
    // saw its socket: it destroys nothing at its timeout and `close` waits on a connection that
    // never ends. Every entrypoint installs the handler before traffic for exactly this reason
    // — the backstop is what keeps the exception from hanging a process that has already
    // replaced the default signal handlers.
    const cleanedUp = vi.fn();
    const onForcedClose = vi.fn();
    const shutdown = shutdownHandler(server, {
      gracePeriodMs: 400,
      onForcedClose,
      onShutdown: async () => {
        await delay(50);
        cleanedUp();
      },
    });

    const started = Date.now();

    // Zero, not one: the budget ran out, which is what it is for. The library counts its own
    // timeout in 250ms hops that slip with the event loop, so a loaded process reaches here on a
    // stop that did nothing wrong, and a non-zero exit on every busy stop reads as a crash.
    expect(await shutdown('SIGTERM')).toBe(0);
    expect(onForcedClose).toHaveBeenCalled();

    expect(Date.now() - started).toBeLessThan(2_000);
    // Cleanup keeps its reserve even though the close spent the whole budget.
    expect(cleanedUp).toHaveBeenCalled();
    expect(await abandoned).toBeInstanceOf(Error);
  });

  it('stays quiet about a forced close when everything finished in time', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const onForcedClose = vi.fn();

    expect(await shutdownHandler(server, { onForcedClose })('SIGTERM')).toBe(0);
    expect(onForcedClose).not.toHaveBeenCalled();
  });

  it('fits the whole stop inside the grace period rather than one budget per phase', async () => {
    const reachedHandler = deferred();
    const { server, url } = await startServer(() => reachedHandler.resolve());
    const stuck = deferred();
    // Every phase overruns: a request that never finishes and cleanup that never settles.
    const shutdown = shutdownHandler(server, {
      gracePeriodMs: 400,
      drainDelayMs: 100,
      onShutdown: () => stuck.promise,
    });

    const abandoned = fetch(`${url}/never`).catch((error: unknown) => error);
    await reachedHandler.promise;
    const started = Date.now();

    expect(await shutdown('SIGTERM')).toBe(1);

    expect(Date.now() - started).toBeLessThan(900);
    expect(await abandoned).toBeInstanceOf(Error);
    stuck.resolve();
  });

  it('ignores a repeated signal instead of shutting down twice', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const onShutdown = vi.fn();
    const shutdown = shutdownHandler(server, { onShutdown });

    const [first, second] = await Promise.all([shutdown('SIGTERM'), shutdown('SIGTERM')]);

    expect(first).toBe(0);
    expect(second).toBe(0);
    expect(onShutdown).toHaveBeenCalledTimes(1);
  });
});
