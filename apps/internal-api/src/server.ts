import { startApiServer } from '@fphd/api-server';
import { createLogger } from '@fphd/logger';

import { createApp } from './app.js';
import * as config from './config.js';

const logger = createLogger({
  name: 'internal-api',
  level: config.log.level,
  pretty: config.log.pretty,
});

startApiServer({
  app: createApp(),
  host: config.host,
  port: config.port,
  onListening: () => logger.info({ port: config.port }, 'Internal API listening'),
});
