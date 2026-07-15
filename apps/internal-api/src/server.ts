import { createLogger } from '@fphd/logger';

import { createApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();

const logger = createLogger({
  name: 'internal-api',
  level: config.log.level,
  pretty: config.log.pretty,
});

createApp().listen(config.port, config.host, () => {
  logger.info({ port: config.port }, 'Internal API listening');
});
