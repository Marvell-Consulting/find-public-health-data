import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';
import { internalCiMethodsRouter } from './ci-methods.ts';
import { indicatorSectionsRouter } from './indicator-sections.ts';
import { internalIndicatorsRouter } from './indicators.ts';
import type { InternalRepositories } from './repositories.ts';
import { internalTopicsRouter } from './topics.ts';

export type { CiMethodRow } from './ci-method-repository.ts';
export type {
  CreateDraftFromPublishedResult,
  CreatedIndicatorDraft,
  CreateIndicatorDraftResult,
  IndicatorAdminDetailRow,
  IndicatorAdminRow,
  IndicatorAdminRows,
  IndicatorDraft,
  IndicatorDraftAttributes,
  IndicatorDraftLists,
  IndicatorDraftStateRow,
  IndicatorDraftVersion,
  NewIndicatorDraftAttributes,
  UkDateTime,
  UpdateIndicatorDraftResult,
} from './indicator-repository.ts';
export {
  type IndicatorTaskListDraft,
  type IndicatorTaskListSource,
  indicatorTaskList,
} from './indicator-task-list.ts';
export { INDICATORS_PAGE_SIZE, internalIndicatorsRouter } from './indicators.ts';
export {
  createInternalRepositories,
  type InternalCiMethodRepository,
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
  router.use(indicatorSectionsRouter(repositories, session));
  router.use(internalCiMethodsRouter(repositories.ciMethods, session));
  router.use(internalTopicsRouter(repositories.topics, session));

  return router;
}
