import { startServer } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import { createRepositories } from '@fphd/db';
import { createLogger } from '@fphd/logger';

import { createApp } from './app.js';
import * as config from './config.js';
import { db } from './db.js';

const logger = createLogger({
  name: 'internal-api',
  level: config.log.level,
  pretty: config.log.pretty,
});

startServer({
  app: createApp({
    repositories: createRepositories(db),
    session: createJwtSessionVerifier(
      createJwtSessionService({
        audience: 'fphd-internal',
        cookieName: 'fphd-internal-session',
        issuer: 'fphd-auth',
        ...config.session,
      }),
    ),
  }),
  host: config.host,
  port: config.port,
  drainDelayMs: config.shutdown.drainDelayMs,
  gracePeriodMs: config.shutdown.gracePeriodMs,
  onListening: () => logger.info({ port: config.port }, 'Internal API listening'),
  onShutdown: async (signal) => {
    await db.$client.end();
    logger.info({ signal }, 'Internal API stopped');
  },
  onForcedClose: () => logger.warn('Internal API destroyed requests still running at the deadline'),
  onError: (error) => logger.error({ err: error }, 'Internal API did not stop cleanly'),
});
