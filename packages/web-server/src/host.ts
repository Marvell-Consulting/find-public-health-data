import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import express, { type Express, type RequestHandler } from 'express';
import morgan from 'morgan';

const healthcheckPaths = ['/healthcheck', '/healthcheck/live', '/healthcheck/ready'];

function createHost() {
  const app = express();

  app.disable('x-powered-by');
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
  const app = createHost();

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
  port: number;
  rootDirectory: string;
}

export async function startReactRouterServer({
  development,
  host,
  onListening,
  port,
  rootDirectory,
}: ReactRouterServerOptions) {
  let app: Express;

  if (development) {
    const vite = await import('vite').then(({ createServer }) =>
      createServer({
        appType: 'custom',
        root: rootDirectory,
        server: { middlewareMode: true },
      }),
    );

    app = createHost();
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

  return app.listen(port, host, onListening);
}
