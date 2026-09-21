// Re-exported so schema fragments and app schemas are always built with the same zod
// instance — depend on @fphd/config, not on zod directly.
export { z } from 'zod';
export {
  type AppEnv,
  appEnvFields,
  appEnvSchema,
  boolSchema,
  isDeployedEnv,
  loadWebServerConfig,
  logEnvFields,
  parseEnv,
  portSchema,
  resolveLog,
  resolveShutdown,
  serverEnvFields,
} from './env.ts';
export {
  isReservedSlug,
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  type SlugProblem,
  slugify,
  slugProblem,
} from './slug.ts';
