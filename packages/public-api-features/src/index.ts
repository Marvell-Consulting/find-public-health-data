import type { Repositories } from '@fphd/db';
import { Router } from 'express';

import { areasRouter } from './areas.ts';
import { indicatorsRouter } from './indicators.ts';
import { topicsRouter } from './topics.ts';

export { areasRouter } from './areas.ts';
export { indicatorsRouter } from './indicators.ts';
export { topicsRouter } from './topics.ts';

/**
 * Every route on the public API surface, in one router. `internal-api` mounts this too, so
 * it is a superset of the public API by construction — a new public endpoint cannot be
 * added to one app and forgotten in the other.
 */
export function publicApiRoutes(repositories: Repositories): Router {
  const router = Router();

  router.use(areasRouter(repositories.areas));
  router.use(indicatorsRouter(repositories.indicators));
  router.use(topicsRouter(repositories.topics));

  return router;
}
