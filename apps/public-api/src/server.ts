import { startServer } from '@fphd/api-server';
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
  app: createApp({ repositories: createRepositories(db) }),
  host: config.host,
  port: config.port,
  drainDelayMs: config.shutdown.drainDelayMs,
  gracePeriodMs: config.shutdown.gracePeriodMs,
  onListening: () => logger.info({ port: config.port }, 'Public API listening'),
  onShutdown: async (signal) => {
    await db.$client.end();
    logger.info({ signal }, 'Public API stopped');
  },
  onForcedClose: () => logger.warn('Public API destroyed requests still running at the deadline'),
  onError: (error) => logger.error({ err: error }, 'Public API did not stop cleanly'),
});
