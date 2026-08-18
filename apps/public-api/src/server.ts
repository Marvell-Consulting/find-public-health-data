import { serverLogging, startServer } from '@fphd/api-server';
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

startServer({
  app: createApp({ repositories: createRepositories(db), rateLimit: config.rateLimit }),
  host: config.host,
  port: config.port,
  shutdown: config.shutdown,
  ...serverLogging(logger, { port: config.port, onShutdown: () => db.$client.end() }),
});
