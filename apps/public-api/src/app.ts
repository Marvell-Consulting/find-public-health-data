import express, { type Express } from 'express';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: 'public-api' });
  });

  app.get('/api', (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'public',
    });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });

  return app;
}
