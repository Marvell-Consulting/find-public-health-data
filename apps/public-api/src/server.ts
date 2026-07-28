import { startApiServer } from '@fphd/api-server';
import { listTopics } from '@fphd/db';
import { createLogger } from '@fphd/logger';

import { createApp, type TopicsReader } from './app.js';
import * as config from './config.js';
import { db } from './db.js';

const logger = createLogger({
  name: 'public-api',
  level: config.log.level,
  pretty: config.log.pretty,
});

const topics: TopicsReader = {
  list: async () =>
    (await listTopics(db)).map(({ slug, title, createdAt, updatedAt }) => ({
      slug,
      title,
      createdAt,
      updatedAt,
    })),
};

startApiServer({
  app: createApp({ db, topics }),
  host: config.host,
  port: config.port,
  onListening: () => logger.info({ port: config.port }, 'Public API listening'),
});
