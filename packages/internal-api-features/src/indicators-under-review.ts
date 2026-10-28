import { requireApiSession, requireJwtSession } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { canAssignReviewers, indicatorListScope } from '@fphd/auth/permissions';
import { Router } from 'express';

import type { IndicatorsUnderReview } from './contract.ts';
import { toListItem } from './indicators.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

/** The IMRG manager's queue: every open submission they may see, unpaginated. */
export function internalIndicatorsUnderReviewRouter(
  indicators: Pick<InternalIndicatorRepository, 'listUnderReview'>,
  session: JwtSessionVerifier,
): Router {
  const router = Router();

  router.get(
    '/api/internal/indicators-under-review',
    requireJwtSession(session, canAssignReviewers),
    async (_request, response) => {
      const rows = await indicators.listUnderReview(
        indicatorListScope(requireApiSession(response)),
      );
      const body: IndicatorsUnderReview = {
        unassigned: rows.unassigned.map(toListItem),
        assigned: rows.assigned.map(toListItem),
      };

      response.status(200).json(body);
    },
  );

  return router;
}
