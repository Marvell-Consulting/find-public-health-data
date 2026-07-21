import { addNotFoundHandler, createApiApp } from '@fphd/api-server';

export function createApp() {
  const app = createApiApp('public-api');
  addNotFoundHandler(app);
  return app;
}
