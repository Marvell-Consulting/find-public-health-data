import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShutdownHandler, shutdownServer } from './index.js';

type Handler = Parameters<typeof createServer>[1];

let running: Server | undefined;

async function startServer(handler: Handler): Promise<{ server: Server; url: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  running = server;

  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
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

    await expect(fetch(`${url}/late`)).rejects.toThrow();

    releaseHandler.resolve();
    await inFlight;
    await shutdown;
  });

  it('does not wait out the timeout for an idle keep-alive connection', async () => {
    const { server, url } = await startServer((_request, response) => response.end('ok'));

    // Leaves a keep-alive socket open with no request on it — `close` alone would hold on to
    // that socket until the timeout, which is the case closeIdleConnections exists for.
    await (await fetch(`${url}/`)).text();

    const started = Date.now();
    await shutdownServer(server, 5_000);

    expect(Date.now() - started).toBeLessThan(1_000);
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

  it('passes the signal through to onShutdown', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const onShutdown = vi.fn();

    await createShutdownHandler(server, { onShutdown })('SIGINT');

    expect(onShutdown).toHaveBeenCalledWith('SIGINT');
  });

  it('reports failure when cleanup throws, rather than exiting as if it had worked', async () => {
    const { server } = await startServer((_request, response) => response.end('ok'));
    const shutdown = createShutdownHandler(server, {
      onShutdown: () => {
        throw new Error('pool refused to close');
      },
    });

    expect(await shutdown('SIGTERM')).toBe(1);
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
