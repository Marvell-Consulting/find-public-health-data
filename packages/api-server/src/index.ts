import express, { type Express } from 'express';

export type ApiAudience = 'internal' | 'public';

export function createApiApp(audience: ApiAudience): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: `${audience}-api` });
  });

  app.get('/api', (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'public',
    });
  });

  if (audience === 'internal') {
    app.get('/api/internal', (_request, response) => {
      response.status(200).json({
        service: 'find-public-health-data',
        audience: 'internal',
      });
    });
  }

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });

  return app;
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
