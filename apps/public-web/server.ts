import { createLogger } from '@fphd/logger';
import { startReactRouterServer } from '@fphd/web-server';

import * as config from './server/config.ts';

const logger = createLogger({
  name: 'public-web',
  level: config.log.level,
  pretty: config.log.pretty,
});

await startReactRouterServer({
  development: config.development,
  host: config.host,
  port: config.port,
  onListening: () => logger.info({ port: config.port }, 'Public web listening'),
  rootDirectory: import.meta.dirname,
});
