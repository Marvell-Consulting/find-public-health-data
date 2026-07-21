import express, { type Express } from 'express';

export function createApiApp(serviceName: string): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: serviceName });
  });

  app.get('/api', (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'public',
    });
  });

  return app;
}

export function addNotFoundHandler(app: Express) {
  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });
}

interface StartApiServerOptions {
  app: Express;
  host: string;
  onListening: () => void;
  port: number;
}

export function startApiServer({ app, host, onListening, port }: StartApiServerOptions) {
  return app.listen(port, host, onListening);
}
