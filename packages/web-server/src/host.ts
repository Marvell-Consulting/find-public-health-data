import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { installShutdownHandlers, type ShutdownOptions } from '@fphd/server-lifecycle';
import express, { type Express, type RequestHandler } from 'express';
import morgan from 'morgan';

import { securityHeaders } from './security-headers.js';

const healthcheckPaths = ['/healthcheck', '/healthcheck/live', '/healthcheck/ready'];

function createHost({ development }: { development: boolean }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders({ development }));
  app.get(healthcheckPaths, (_request, response) => {
    response.json({ message: 'success' });
  });

  return app;
}

interface ProductionHostOptions {
  clientDirectory: string;
  requestHandler: RequestHandler;
}

export function createProductionHost({
  clientDirectory,
  requestHandler,
}: ProductionHostOptions): Express {
  const app = createHost({ development: false });

  app.use(
    '/assets',
    express.static(join(clientDirectory, 'assets'), { immutable: true, maxAge: '1y' }),
  );
  app.use(express.static(clientDirectory, { index: false, maxAge: '1h' }));
  app.use(morgan('tiny'));
  app.use(requestHandler);

  return app;
}

function isRequestHandler(value: unknown): value is RequestHandler {
  return typeof value === 'function';
}

function readRequestHandler(serverModule: unknown): RequestHandler {
  if (
    typeof serverModule !== 'object' ||
    serverModule === null ||
    !('app' in serverModule) ||
    !isRequestHandler(serverModule.app)
  ) {
    throw new Error('React Router server build must export an Express app');
  }

  return serverModule.app;
}

interface ReactRouterServerOptions {
  development: boolean;
  host: string;
  onListening: () => void;
  /** Runs once the server has stopped serving, before the process exits. */
  onShutdown?: ShutdownOptions['onShutdown'];
  port: number;
  rootDirectory: string;
}

export async function startReactRouterServer({
  development,
  host,
  onListening,
  onShutdown,
  port,
  rootDirectory,
}: ReactRouterServerOptions) {
  let app: Express;
  // In development the Vite server is the handle that would otherwise keep the process alive
  // after the HTTP server has closed — including on every `tsx watch` restart.
  let closeDevServer: (() => Promise<void>) | undefined;

  if (development) {
    const vite = await import('vite').then(({ createServer }) =>
      createServer({
        appType: 'custom',
        root: rootDirectory,
        server: { middlewareMode: true },
      }),
    );
    closeDevServer = () => vite.close();

    app = createHost({ development: true });
    app.use(vite.middlewares);
    app.use(async (request, response, next) => {
      try {
        const serverModule: unknown = await vite.ssrLoadModule('./server/app.ts');
        const requestHandler = readRequestHandler(serverModule);
        await requestHandler(request, response, next);
      } catch (error) {
        if (error instanceof Error) vite.ssrFixStacktrace(error);
        next(error);
      }
    });
  } else {
    const clientDirectory = join(rootDirectory, 'dist/client');
    const buildUrl = pathToFileURL(join(rootDirectory, 'dist/server/index.js')).href;
    const serverModule: unknown = await import(buildUrl);
    const requestHandler = readRequestHandler(serverModule);

    app = createProductionHost({ clientDirectory, requestHandler });
  }

  const server = app.listen(port, host, onListening);
  installShutdownHandlers(server, {
    onShutdown: async (signal) => {
      await closeDevServer?.();
      await onShutdown?.(signal);
    },
  });

  return server;
}
