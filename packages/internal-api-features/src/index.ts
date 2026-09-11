import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';

import { internalIndicatorsRouter } from './indicators.js';
import type { InternalRepositories } from './repositories.js';
import { internalTopicsRouter } from './topics.js';

export type { IndicatorAdminRow, IndicatorAdminRows } from './indicator-repository.js';
export { INDICATORS_PAGE_SIZE, internalIndicatorsRouter } from './indicators.js';
export {
  createInternalRepositories,
  type InternalIndicatorRepository,
  type InternalRepositories,
  type InternalTopicRepository,
} from './repositories.js';
export type {
  CreateTopicResult,
  DeleteTopicResult,
  TopicUpdate,
  UpdateTopicResult,
} from './topic-repository.js';
export { internalTopicsRouter } from './topics.js';

export interface InternalApiDependencies {
  repositories: InternalRepositories;
  session: JwtSessionVerifier;
}

/**
 * Every route on the internal-only surface, in one router. `public-api` never mounts this,
 * and `tools/artefact-boundary` checks that no public artifact can reach it.
 */
export function internalApiRoutes({ repositories, session }: InternalApiDependencies): Router {
  const router = Router();

  router.use(internalIndicatorsRouter(repositories.indicators, session));
  router.use(internalTopicsRouter(repositories.topics, session));

  return router;
}
