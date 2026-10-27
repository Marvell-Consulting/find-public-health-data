import { requireJwtSession } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { canAssignReviewers } from '@fphd/auth/permissions';
import { Router } from 'express';

import { indicatorIdSchema, type ReviewerOptions } from './contract.ts';
import type { IndicatorTeams } from './indicator-editor.ts';
import type { InternalReviewerRepository } from './repositories.ts';

/** The reviewers an IMRG manager may assign to an indicator. */
export function internalReviewersRouter(
  reviewers: InternalReviewerRepository,
  indicators: IndicatorTeams,
  session: JwtSessionVerifier,
): Router {
  const router = Router();

  router.get(
    '/api/internal/indicators/:id/reviewer-options',
    requireJwtSession(session, canAssignReviewers),
    async (request, response) => {
      const id = indicatorIdSchema.safeParse(request.params.id);

      if (!id.success) {
        response.status(400).json({ error: 'invalid_id' });
        return;
      }

      if ((await indicators.findTeamId(id.data)) === undefined) {
        response.status(404).json({ error: 'not_found' });
        return;
      }

      const body: ReviewerOptions = { reviewers: await reviewers.listOptions(id.data) };

      response.status(200).json(body);
    },
  );

  return router;
}
