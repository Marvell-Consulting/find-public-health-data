import { createLogger } from '@fphd/logger';
import { startReactRouterServer } from '@fphd/web-server';

import * as config from './server/config.ts';

const logger = createLogger({
  name: 'internal-web',
  level: config.log.level,
  pretty: config.log.pretty,
});

await startReactRouterServer({
  development: config.development,
  host: config.host,
  port: config.port,
  drainMs: config.shutdown.drainMs,
  onListening: () => logger.info({ port: config.port }, 'Internal web listening'),
  onError: (error) => logger.error({ err: error }, 'Internal web did not stop cleanly'),
  rootDirectory: import.meta.dirname,
  serviceName: 'internal-web',
});
