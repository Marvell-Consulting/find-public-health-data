import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { installShutdownHandlers, type ShutdownOptions } from '@fphd/server-lifecycle';
import express, { type Express, type RequestHandler } from 'express';
import morgan from 'morgan';

import { securityHeaders } from './security-headers.js';

/**
 * The same three paths and the same body as `@fphd/api-server` serves, so one probe
 * configuration covers all four apps — mirror any change to one in the other.
 */
function createHost({ development, serviceName }: { development: boolean; serviceName: string }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders({ development }));
  app.get(['/health', '/health/live'], (_request, response) => {
    response.json({ status: 'ok', service: serviceName });
  });

  // Readiness is separate from the other two: during a stop the process is alive and still
  // serving, but it must stop being routed to before it closes anything.
  app.get('/health/ready', (request, response) => {
    const draining = request.app.locals.draining === true;
    response
      .status(draining ? 503 : 200)
      .json({ status: draining ? 'draining' : 'ok', service: serviceName });
  });

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

interface ReactRouterServerOptions {
  development: boolean;
  /** How long to keep serving after the signal, before closing anything. */
  drainMs?: ShutdownOptions['drainMs'];
  host: string;
  /** Reports a stop that failed; the lifecycle package cannot log. */
  onError?: ShutdownOptions['onError'];
  onListening: () => void;
  port: number;
  rootDirectory: string;
  /** Names this app in its health responses, where four apps sit behind one front door. */
  serviceName: string;
}

export async function startReactRouterServer({
  development,
  drainMs,
  host,
  onError,
  onListening,
  port,
  rootDirectory,
  serviceName,
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

  const server = app.listen(port, host, onListening);
  installShutdownHandlers(server, {
    drainMs,
    onDraining: () => {
      app.locals.draining = true;
    },
    onError,
    onShutdown: closeDevServer,
  });

  return server;
}
