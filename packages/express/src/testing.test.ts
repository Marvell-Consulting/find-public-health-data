import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { request } from './testing.ts';

let squatter: Server | undefined;

afterEach(() => {
  squatter?.close();
  squatter = undefined;
});

/** Listens on 127.0.0.1 at the port, answering 401, unless something there already holds it. */
async function squat(port: number): Promise<void> {
  const server = createServer((_request, response) => response.writeHead(401).end());

  await new Promise<void>((resolve) => {
    server.once('error', () => resolve());
    server.listen(port, '127.0.0.1', () => {
      squatter = server;
      resolve();
    });
  });
}

describe('request', () => {
  // As an editor's local server on 127.0.0.1 once did to a server listening on every interface.
  it('reaches the server under test when another listener wants its port on 127.0.0.1', async () => {
    const server = createServer((_request, response) => response.writeHead(204).end());
    const test = request(server).get('/');

    await once(server, 'listening');
    await squat((server.address() as AddressInfo).port);

    expect((await test).status).toBe(204);
  });

  it('closes the server once the response is in', async () => {
    const server = createServer((_request, response) => response.writeHead(204).end());

    await request(server).get('/');

    expect(server.listening).toBe(false);
  });

  it('reports a server that cannot listen', async () => {
    const server = createServer();
    server.listen = () => {
      queueMicrotask(() => server.emit('error', new Error('cannot listen')));
      return server;
    };

    await expect(request(server).get('/')).rejects.toThrow('cannot listen');
  });
});
