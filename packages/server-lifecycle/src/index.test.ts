import { Agent, createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShutdownHandler, drainServer, shutdownServer } from './index.js';

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
 * could be a pooled socket the server had already closed rather than the listener refusing to
 * accept — which is the thing under test.
 */
function requestOnNewConnection(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { agent: false }, () => resolve());
    outgoing.on('error', reject);
    outgoing.end();
  });
}

/**
 * A keep-alive socket the test owns. `fetch` decides for itself when to close a pooled
 * connection, and what these tests turn on is the socket still being open, and idle, once the
 * response has ended.
 */
function keepAliveRequest(url: string, agent: Agent): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { agent }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.headers.connection));
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

afterEach(async () => {
  if (running?.listening === true) {
    running.closeAllConnections();
    await new Promise((resolve) => running?.close(resolve));
  }
  running = undefined;
});

describe('drainServer', () => {
  it('keeps serving while it drains, and tells the client to retire the connection', async () => {
    let served = 0;
    const { server, url } = await startServer((_request, response) => {
      served += 1;
      response.end('ok');
    });
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });

    expect(await keepAliveRequest(`${url}/before`, agent)).toBe('keep-alive');

    const draining = drainServer(server, 20);
    // Served on the pooled socket, and answered with the header that has the client close it
    // itself — rather than the socket being destroyed under a request it had already written.
    expect(await keepAliveRequest(`${url}/during`, agent)).toBe('close');
    await draining;

    expect(served).toBe(2);
    expect(server.listening).toBe(true);
    agent.destroy();
  });

  it('fails readiness as it starts, not once the wait is over', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const onDraining = vi.fn();

    const draining = drainServer(server, 20, onDraining);

    expect(onDraining).toHaveBeenCalled();
    await draining;
  });
});

describe('shutdownServer', () => {
  it('stops the server listening', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));

    await shutdownServer(server);

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

    const inFlight = fetch(`${url}/slow`);
    await reachedHandler.promise;

    const settled = vi.fn();
    const shutdown = shutdownServer(server).then(settled);

    // The request is still being served, so the shutdown must not have completed.
    await new Promise((resolve) => setTimeout(resolve, 20));
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

    const inFlight = fetch(`${url}/slow`);
    await reachedHandler.promise;
    const shutdown = shutdownServer(server);

    await expect(requestOnNewConnection(`${url}/late`)).rejects.toThrow();

    releaseHandler.resolve();
    await inFlight;
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

    // The socket is busy when the shutdown starts and idle a moment later, so the single sweep
    // `close` performs as it is called cannot see it. Without a repeated sweep this waits out
    // Node's five-second keep-alive timeout for a connection carrying no work.
    const inFlight = keepAliveRequest(`${url}/slow`, agent);
    await reachedHandler.promise;

    const started = Date.now();
    const shutdown = shutdownServer(server, 5_000);
    releaseHandler.resolve();
    await inFlight;
    await shutdown;

    expect(Date.now() - started).toBeLessThan(1_000);
    agent.destroy();
  });

  it('destroys a connection still mid-request once the timeout expires', async () => {
    const reachedHandler = deferred();
    const { server, url } = await startServer(() => {
      // Never responds: the handler that a graceful shutdown must not wait on forever.
      reachedHandler.resolve();
    });

    const abandoned = fetch(`${url}/never`);
    await reachedHandler.promise;

    await shutdownServer(server, 50);

    expect(server.listening).toBe(false);
    await expect(abandoned).rejects.toThrow();
  });
});

describe('createShutdownHandler', () => {
  it('runs onShutdown after the server has closed, and reports success', async () => {
    const closedWhenCalled = deferred<boolean>();
    const { server } = await startServer((_request, response) => response.end('ok'));
    const shutdown = createShutdownHandler(server, {
      onShutdown: () => closedWhenCalled.resolve(server.listening === false),
    });

    expect(await shutdown('SIGTERM')).toBe(0);
    expect(await closedWhenCalled.promise).toBe(true);
  });

  it('drains while still listening, and only then closes', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const listeningWhenDraining = deferred<boolean>();
    const shutdown = createShutdownHandler(server, {
      drainMs: 20,
      onDraining: () => listeningWhenDraining.resolve(server.listening),
    });

    expect(await shutdown('SIGTERM')).toBe(0);
    expect(await listeningWhenDraining.promise).toBe(true);
    expect(server.listening).toBe(false);
  });

  it('passes the signal through to onShutdown', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const onShutdown = vi.fn();

    await createShutdownHandler(server, { onShutdown })('SIGINT');

    expect(onShutdown).toHaveBeenCalledWith('SIGINT');
  });

  it('reports failure when cleanup throws, rather than exiting as if it had worked', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const failure = new Error('pool refused to close');
    const onError = vi.fn();
    const shutdown = createShutdownHandler(server, {
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

    const exitCode = await createShutdownHandler(server, { onShutdown, onError })('SIGTERM');

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
    const shutdown = createShutdownHandler(server, {
      onShutdown: () => stuck.promise,
      onError,
      timeoutMs: 50,
    });

    expect(await shutdown('SIGTERM')).toBe(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    stuck.resolve();
  });

  it('ignores a repeated signal instead of shutting down twice', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const onShutdown = vi.fn();
    const shutdown = createShutdownHandler(server, { onShutdown });

    const [first, second] = await Promise.all([shutdown('SIGTERM'), shutdown('SIGTERM')]);

    expect(first).toBe(0);
    expect(second).toBe(0);
    expect(onShutdown).toHaveBeenCalledTimes(1);
  });
});
