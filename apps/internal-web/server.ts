import { createLogger } from '@fphd/logger';
import { startReactRouterServer } from '@fphd/web-server';

const logger = createLogger({ name: 'internal-web' });

await startReactRouterServer({
  defaultPort: 3001,
  onListening: () => logger.info('Internal web listening'),
  rootDirectory: import.meta.dirname,
});
