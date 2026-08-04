import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Repositories } from '@fphd/db';
import { Router } from 'express';

import { internalTopicsRouter } from './topics.js';

export { internalTopicsRouter } from './topics.js';

export interface InternalApiDependencies {
  repositories: Repositories;
  session: JwtSessionVerifier;
}

/**
 * Every route on the internal-only surface, in one router. `public-api` never mounts this,
 * and `tools/artefact-boundary` checks that no public artifact can reach it.
 */
export function internalApiRoutes({ repositories, session }: InternalApiDependencies): Router {
  const router = Router();

  router.use(internalTopicsRouter(repositories.topics, session));

  return router;
}
