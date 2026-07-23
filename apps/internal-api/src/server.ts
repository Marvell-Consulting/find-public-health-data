import { startApiServer } from '@fphd/api-server';
import { createJwtSessionService, createJwtSessionVerifier } from '@fphd/auth/jwt-session';
import { createLogger } from '@fphd/logger';

import { createApp } from './app.js';
import * as config from './config.js';

const logger = createLogger({
  name: 'internal-api',
  level: config.log.level,
  pretty: config.log.pretty,
});

startApiServer({
  app: createApp(
    createJwtSessionVerifier(
      createJwtSessionService({
        audience: 'fphd-internal',
        cookieName: 'fphd-internal-session',
        issuer: 'fphd-auth',
        ...config.session,
      }),
    ),
  ),
  host: config.host,
  port: config.port,
  onListening: () => logger.info({ port: config.port }, 'Internal API listening'),
});
