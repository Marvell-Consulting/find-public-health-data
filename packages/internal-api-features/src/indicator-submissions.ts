import { requireApiActor, requireApiSession } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { type Request, type Response, Router } from 'express';

import {
  type IndicatorStep,
  type IndicatorSubmitError,
  type IndicatorWithdrawError,
  indicatorIdSchema,
  indicatorSubmitSchema,
  indicatorWithdrawSchema,
} from './contract.ts';
import { requireIndicatorEditor } from './indicator-editor.ts';
import { mayTakeStep } from './indicator-workflow.ts';
import type { IndicatorStepResult } from './indicator-workflow-repository.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

/**
 * The indicator `:id` names, once the user may take `step` on it, or undefined once the answer is
 * sent: 400 for an id that is not one, 404 for no such indicator, 403 for a user who may not.
 */
async function stepIndicatorId(
  indicators: Pick<InternalIndicatorRepository, 'findTeamId'>,
  step: IndicatorStep,
  request: Request,
  response: Response,
): Promise<string | undefined> {
  const id = indicatorIdSchema.safeParse(request.params.id);

  if (!id.success) {
    response.status(400).json({ error: 'invalid_id' });
    return undefined;
  }

  const teamId = await indicators.findTeamId(id.data);

  if (teamId === undefined) {
    response.status(404).json({ error: 'not_found' });
    return undefined;
  }

  if (!mayTakeStep(requireApiSession(response), { teamId }, step)) {
    response.status(403).json({ error: 'forbidden' });
    return undefined;
  }

  return id.data;
}

/** A refused step: no draft is a 404, and every other reason a 409 naming it. */
function refuse<Reason extends string>(
  response: Response,
  { reason }: Extract<IndicatorStepResult<Reason>, { ok: false }>,
): void {
  response.status(reason === 'no_draft' ? 404 : 409).json({ error: reason });
}

/** The publisher's steps through review: submitting a draft for approval and withdrawing it. */
export function indicatorSubmissionsRouter(
  indicators: InternalIndicatorRepository,
  session: JwtSessionVerifier,
): Router {
  const router = Router();
  const requireEditor = requireIndicatorEditor(session, indicators);

  router.post('/api/internal/indicators/:id/submit', requireEditor, async (request, response) => {
    const id = await stepIndicatorId(indicators, 'submit', request, response);

    if (id === undefined) return;

    const body = indicatorSubmitSchema.safeParse(request.body);

    if (!body.success) {
      response
        .status(400)
        .json({ error: 'invalid_draft_updated_at' } satisfies IndicatorSubmitError);
      return;
    }

    const result = await indicators.submit(
      id,
      new Date(body.data.draftUpdatedAt),
      requireApiActor(request, response),
    );

    if (!result.ok) {
      refuse(response, result);
      return;
    }

    request.log.info({ indicatorId: id }, 'Indicator submitted');
    response.status(204).end();
  });

  router.post('/api/internal/indicators/:id/withdraw', requireEditor, async (request, response) => {
    const id = await stepIndicatorId(indicators, 'withdraw', request, response);

    if (id === undefined) return;

    const body = indicatorWithdrawSchema.safeParse(request.body);

    if (!body.success) {
      response
        .status(400)
        .json({ error: 'invalid_submission_number' } satisfies IndicatorWithdrawError);
      return;
    }

    const result = await indicators.withdraw(
      id,
      body.data.submissionNumber,
      requireApiActor(request, response),
    );

    if (!result.ok) {
      refuse(response, result);
      return;
    }

    request.log.info({ indicatorId: id }, 'Indicator submission withdrawn');
    response.status(204).end();
  });

  return router;
}
