// Re-exported so schema fragments and app schemas are always built with the same zod
// instance — depend on @fphd/config, not on zod directly.
export { z } from 'zod';
export {
  appEnvSchema,
  boolSchema,
  loadWebServerConfig,
  logEnvFields,
  parseEnv,
  portSchema,
  serverEnvFields,
} from './env.js';
