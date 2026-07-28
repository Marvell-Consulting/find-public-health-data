import { startApiServer } from '@fphd/api-server';
import { createRepositories } from '@fphd/db';
import { createLogger } from '@fphd/logger';

import { createApp } from './app.js';
import * as config from './config.js';
import { db } from './db.js';

const logger = createLogger({
  name: 'public-api',
  level: config.log.level,
  pretty: config.log.pretty,
});

startApiServer({
  app: createApp({ repositories: createRepositories(db) }),
  host: config.host,
  port: config.port,
  onListening: () => logger.info({ port: config.port }, 'Public API listening'),
});
