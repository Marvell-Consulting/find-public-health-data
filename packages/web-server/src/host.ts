import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createBaseApp, requestLogging, type StartServerOptions, startServer } from '@fphd/express';
import type { Logger } from '@fphd/logger';
import compression from 'compression';
import express, { type Express, type RequestHandler } from 'express';

import { securityHeaders } from './security-headers.js';

export { serverLogging } from '@fphd/express';

interface HostOptions {
  development: boolean;
  logger: Logger;
  serviceName: string;
}

function createHost({ development, logger, serviceName }: HostOptions) {
  const app = createBaseApp({ serviceName });

  // Handed to the React Router app on the response, as the nonce is.
  app.use((_request, response, next) => {
    response.locals.logger = logger;
    next();
  });

  // After the base, so its JSON probe responses answer without a CSP.
  app.use(securityHeaders({ development }));
  // At the host so static assets compress too; Front Door does not compress.
  app.use(compression());

  return app;
}

interface ProductionHostOptions {
  clientDirectory: string;
  logger: Logger;
  requestHandler: RequestHandler;
  serviceName: string;
}

export function createProductionHost({
  clientDirectory,
  logger,
  requestHandler,
  serviceName,
}: ProductionHostOptions): Express {
  const app = createHost({ development: false, logger, serviceName });

  app.use(
    '/assets',
    express.static(join(clientDirectory, 'assets'), { immutable: true, maxAge: '1y' }),
  );
  app.use(express.static(clientDirectory, { index: false, maxAge: '1h' }));
  // After the static handlers, so asset hits stay out of the log.
  app.use(requestLogging(logger));
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
  logger: Logger;
  rootDirectory: string;
  /** Names this app in its health responses. */
  serviceName: string;
}

export async function startReactRouterServer({
  development,
  logger,
  onShutdown,
  rootDirectory,
  serviceName,
  ...options
}: ReactRouterServerOptions) {
  let app: Express;
  // The handle that would otherwise keep the process alive after the HTTP server has closed,
  // including on every `tsx watch` restart.
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
    // Vite only watches its root (the app directory), but this app's source lives in the
    // workspace packages outside it — without this, edits there never hot reload. The
    // watcher's own ignore list still excludes node_modules.
    vite.watcher.add(join(rootDirectory, '..', '..', 'packages'));

    app = createHost({ development: true, logger, serviceName });
    app.use(vite.middlewares);
    // After Vite's handlers, as production sits after the static ones: page requests only.
    app.use(requestLogging(logger));
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

    app = createProductionHost({ clientDirectory, logger, requestHandler, serviceName });
  }

  return startServer({
    ...options,
    app,
    // `finally`, so a Vite close that rejects does not take the caller's cleanup with it.
    onShutdown: async (signal) => {
      try {
        await closeDevServer?.();
      } finally {
        await onShutdown?.(signal);
      }
    },
  });
}
