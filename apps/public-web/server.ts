import { createLogger } from '@fphd/logger';
import { startReactRouterServer } from '@fphd/web-server';

const logger = createLogger({ name: 'public-web' });

await startReactRouterServer({
  defaultPort: 3000,
  onListening: () => logger.info('Public web listening'),
  rootDirectory: import.meta.dirname,
});
