import { createLogger } from '@fphd/logger';

import { createApp } from './app.js';

const logger = createLogger({ name: 'internal-api' });

const defaultPort = 4001;
const configuredPort = process.env.PORT;
const port = configuredPort === undefined ? defaultPort : Number(configuredPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`PORT must be an integer between 1 and 65535; received ${configuredPort}`);
}

createApp().listen(port, '0.0.0.0', () => {
  logger.info({ port }, 'Internal API listening');
});
