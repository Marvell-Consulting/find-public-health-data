import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createBaseApp, type StartServerOptions, startServer } from '@fphd/express';
import express, { type Express, type RequestHandler } from 'express';
import morgan from 'morgan';

import { securityHeaders } from './security-headers.js';

export { serverLogging } from '@fphd/express';

function createHost({ development, serviceName }: { development: boolean; serviceName: string }) {
  const app = createBaseApp({ serviceName });

  // After the base, so the probes it registered answer without a CSP: a policy constrains what
  // a browser may load while rendering a document, and a JSON probe response has none.
  app.use(securityHeaders({ development }));

  return app;
}

interface ProductionHostOptions {
  clientDirectory: string;
  requestHandler: RequestHandler;
  serviceName: string;
}

export function createProductionHost({
  clientDirectory,
  requestHandler,
  serviceName,
}: ProductionHostOptions): Express {
  const app = createHost({ development: false, serviceName });

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

interface ReactRouterServerOptions extends Omit<StartServerOptions, 'app'> {
  development: boolean;
  rootDirectory: string;
  /** Names this app in its health responses, where four apps sit behind one front door. */
  serviceName: string;
}

export async function startReactRouterServer({
  development,
  onShutdown,
  rootDirectory,
  serviceName,
  ...options
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

    app = createHost({ development: true, serviceName });
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

    app = createProductionHost({ clientDirectory, requestHandler, serviceName });
  }

  return startServer({
    ...options,
    app,
    onShutdown: async (signal) => {
      await closeDevServer?.();
      await onShutdown?.(signal);
    },
  });
}
