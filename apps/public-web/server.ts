import { createLogger } from '@fphd/logger';
import { startReactRouterServer } from '@fphd/web-server';

import * as config from './server/config.ts';

const logger = createLogger({
  name: 'public-web',
  level: config.log.level,
  pretty: config.log.pretty,
});

await startReactRouterServer({
  development: config.development,
  host: config.host,
  port: config.port,
  drainDelayMs: config.shutdown.drainDelayMs,
  gracePeriodMs: config.shutdown.gracePeriodMs,
  onListening: () => logger.info({ port: config.port }, 'Public web listening'),
  onForcedClose: () => logger.warn('Public web destroyed requests still running at the deadline'),
  onError: (error) => logger.error({ err: error }, 'Public web did not stop cleanly'),
  rootDirectory: import.meta.dirname,
  serviceName: 'public-web',
});
