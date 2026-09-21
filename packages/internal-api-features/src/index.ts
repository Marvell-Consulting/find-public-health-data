import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';

import { internalIndicatorsRouter } from './indicators.ts';
import type { InternalRepositories } from './repositories.ts';
import { internalTopicsRouter } from './topics.ts';

export type {
  CreateDraftFromPublishedResult,
  CreatedIndicatorDraft,
  IndicatorAdminDetailRow,
  IndicatorAdminRow,
  IndicatorAdminRows,
  IndicatorDraftAttributes,
  IndicatorDraftMemberships,
  NewIndicatorDraftAttributes,
  UpdateIndicatorDraftResult,
} from './indicator-repository.ts';
export { INDICATORS_PAGE_SIZE, internalIndicatorsRouter } from './indicators.ts';
export {
  createInternalRepositories,
  type InternalIndicatorRepository,
  type InternalRepositories,
  type InternalTopicRepository,
} from './repositories.ts';
export type {
  CreateTopicResult,
  DeleteTopicResult,
  TopicUpdate,
  UpdateTopicResult,
} from './topic-repository.ts';
export { internalTopicsRouter } from './topics.ts';

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
