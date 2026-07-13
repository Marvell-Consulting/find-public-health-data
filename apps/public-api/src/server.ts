import { createLogger } from '@fphd/logger';

import { createApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();

const logger = createLogger({
  name: 'public-api',
  level: config.log.level,
  pretty: config.log.pretty,
});

createApp().listen(config.port, '0.0.0.0', () => {
  logger.info({ port: config.port }, 'Public API listening');
});
