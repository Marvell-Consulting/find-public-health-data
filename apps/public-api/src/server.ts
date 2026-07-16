import { createLogger } from '@fphd/logger';

import { createApp } from './app.js';
import * as config from './config.js';

const logger = createLogger({
  name: 'public-api',
  level: config.log.level,
  pretty: config.log.pretty,
});

createApp().listen(config.port, config.host, () => {
  logger.info({ port: config.port }, 'Public API listening');
});
