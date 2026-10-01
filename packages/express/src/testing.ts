import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import supertest from 'supertest';

type Method = 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';
type Callback = Parameters<supertest.Test['end']>[0];

/**
 * Supertest's `Test` on a server listening on 127.0.0.1, where supertest sends its requests. On
 * macOS a server on every interface loses them to any process on 127.0.0.1 at the same port.
 */
class LoopbackTest extends supertest.Test {
  readonly #server: Server;
  readonly #path: string;
  #listenError: Error | undefined;

  constructor(server: Server, method: Method, path: string) {
    super('http://127.0.0.1', method, path);
    this.#server = server;
    this.#path = path;
    server.once('error', (error) => {
      this.#listenError = error;
    });
    server.listen(0, '127.0.0.1');
  }

  override end(callback?: Callback): this {
    const server = this.#server;

    if (this.#listenError !== undefined) {
      // A listen error leaves no response, as superagent's own connection errors do.
      callback?.(this.#listenError, undefined as never);
      return this;
    }

    if (!server.listening) {
      const settle = () => {
        server.off('listening', settle);
        server.off('error', settle);
        this.end(callback);
      };
      server.once('listening', settle);
      server.once('error', settle);
      return this;
    }

    this.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${this.#path}`;
    return super.end((error, response) => {
      server.close(() => callback?.(error, response));
    });
  }
}

/** Supertest's `request(app)`, each request on its own server listening on 127.0.0.1. */
export function request(
  app: RequestListener | Server,
): Record<Method, (path: string) => LoopbackTest> {
  const test = (method: Method) => (path: string) =>
    new LoopbackTest(typeof app === 'function' ? createServer(app) : app, method, path);

  return {
    delete: test('delete'),
    get: test('get'),
    head: test('head'),
    options: test('options'),
    patch: test('patch'),
    post: test('post'),
    put: test('put'),
  };
}
