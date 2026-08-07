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
  drainMs: config.shutdown.drainMs,
  onListening: () => logger.info({ port: config.port }, 'Public web listening'),
  onError: (error) => logger.error({ err: error }, 'Public web did not stop cleanly'),
  rootDirectory: import.meta.dirname,
  serviceName: 'public-web',
});
