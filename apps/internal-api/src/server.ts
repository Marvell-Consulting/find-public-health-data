import { startApiServer } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import { listTopics } from '@fphd/db';
import { createLogger } from '@fphd/logger';

import { createApp, type TopicsReader } from './app.js';
import * as config from './config.js';
import { db } from './db.js';

const logger = createLogger({
  name: 'internal-api',
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
  app: createApp({
    session: createJwtSessionVerifier(
      createJwtSessionService({
        audience: 'fphd-internal',
        cookieName: 'fphd-internal-session',
        issuer: 'fphd-auth',
        ...config.session,
      }),
    ),
    topics,
  }),
  host: config.host,
  port: config.port,
  onListening: () => logger.info({ port: config.port }, 'Internal API listening'),
});
