import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import compression from 'compression';
import express from 'express';
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

/**
 * @param {{ clientDirectory: string; requestHandler: import('express').RequestHandler }} options
 */
export function createProductionHost({ clientDirectory, requestHandler }) {
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

/**
 * @param {string | undefined} value
 * @param {number} defaultPort
 */
function parsePort(value, defaultPort) {
  const port = value === undefined ? defaultPort : Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

/**
 * @param {{ defaultPort: number; rootDirectory: string }} options
 */
export async function startReactRouterServer({ defaultPort, rootDirectory }) {
  const development = process.env.NODE_ENV === 'development';
  const host = process.env.HOST ?? '0.0.0.0';
  const port = parsePort(process.env.PORT, defaultPort);
  let app;

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
        const serverModule = await vite.ssrLoadModule('./server/app.ts');
        await serverModule.app(request, response, next);
      } catch (error) {
        if (error instanceof Error) vite.ssrFixStacktrace(error);
        next(error);
      }
    });
  } else {
    const clientDirectory = join(rootDirectory, 'dist/client');
    const buildUrl = pathToFileURL(join(rootDirectory, 'dist/server/index.js')).href;
    const requestHandler = await import(buildUrl).then((module) => module.app);

    app = createProductionHost({ clientDirectory, requestHandler });
  }

  return app.listen(port, host, () => {
    console.log(`Web server listening on http://${host}:${port}`);
  });
}
