import { addNotFoundHandler, createApiApp } from '@fphd/api-server';

export function createApp() {
  const app = createApiApp('internal-api');

  app.get('/api/internal', (_request, response) => {
    response.status(200).json({
      service: 'find-public-health-data',
      audience: 'internal',
    });
  });

  addNotFoundHandler(app);
  return app;
}
