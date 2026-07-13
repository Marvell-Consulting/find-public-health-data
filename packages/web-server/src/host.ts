import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import compression from 'compression';
import express, { type Express, type RequestHandler } from 'express';
import morgan from 'morgan';

const healthcheckPaths = ['/healthcheck', '/healthcheck/live', '/healthcheck/ready'];

function createHost() {
  const app = express();

  app.disable('x-powered-by');
  app.use(compression());
  app.get(healthcheckPaths, (_request, response) => {
    response.json({ message: 'success' });
  });

  return app;
}

interface ProductionHostOptions {
  clientDirectory: string;
  requestHandler: RequestHandler;
}

export function createProductionHost({ clientDirectory, requestHandler }: ProductionHostOptions) {
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

function parsePort(value: string | undefined, defaultPort: number) {
  const port = value === undefined ? defaultPort : Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
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
  defaultPort: number;
  rootDirectory: string;
}

export async function startReactRouterServer({
  defaultPort,
  rootDirectory,
}: ReactRouterServerOptions) {
  const development = process.env.NODE_ENV === 'development';
  const host = process.env.HOST ?? '0.0.0.0';
  const port = parsePort(process.env.PORT, defaultPort);
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

  return app.listen(port, host, () => {
    console.log(`Web server listening on http://${host}:${port}`);
  });
}
