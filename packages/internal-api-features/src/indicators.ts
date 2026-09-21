import { requireApiSession, requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';

import {
  type IndicatorAdminDetail,
  type IndicatorAdminPage,
  type IndicatorAdminSummary,
  indicatorIdSchema,
  indicatorNameSchema,
  indicatorPageQuerySchema,
  toFieldErrors,
} from './contract.ts';
import type { IndicatorAdminDetailRow, IndicatorAdminRow } from './indicator-repository.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

export const INDICATORS_PAGE_SIZE = 10;

// Two indicators cannot share a slug, and the name is what the publisher chose, so the
// collision is reported against the name rather than the slug they never saw.
const NAME_TAKEN = 'An indicator with this name already exists';

function toSummary({ id, name, updatedAt }: IndicatorAdminRow): IndicatorAdminSummary {
  return { id, name, updatedAt: updatedAt.toISOString() };
}

function toDetail(row: IndicatorAdminDetailRow): IndicatorAdminDetail {
  return {
    ...toSummary(row),
    shortId: row.shortId,
    publishedSlug: row.publishedSlug,
    status: row.status,
  };
}

/**
 * The publisher's view of indicators: every one, including the unpublished ones the public
 * API never serves. Mounted only by `internal-api`; `public-api` must 404 every path.
 */
export function internalIndicatorsRouter(
  indicators: InternalIndicatorRepository,
  session: JwtSessionVerifier,
): Router {
  const router = Router();
  const requirePublisher = requireJwtRole(session, 'publisher');

  router.get('/api/internal/indicators', requirePublisher, async (request, response) => {
    const query = indicatorPageQuerySchema.safeParse(request.query);

    if (!query.success) {
      response.status(400).json({ error: 'invalid_page' });
      return;
    }

    const { page } = query.data;
    const rows = await indicators.listPage(page, INDICATORS_PAGE_SIZE);
    const body: IndicatorAdminPage = {
      indicators: rows.indicators.map(toSummary),
      page,
      pageSize: INDICATORS_PAGE_SIZE,
      total: rows.total,
    };

    response.status(200).json(body);
  });

  router.post('/api/internal/indicators', requirePublisher, async (request, response) => {
    // Validated here as well as at the form: the API is reachable without going through it.
    const submission = indicatorNameSchema.safeParse(request.body);

    if (!submission.success) {
      response
        .status(400)
        .json({ error: 'validation_failed', fieldErrors: toFieldErrors(submission.error) });
      return;
    }

    const { sub } = requireApiSession(response);
    const created = await indicators.createDraft(submission.data, sub);

    if (!created.ok) {
      response.status(409).json({ error: 'slug_taken', fieldErrors: { name: NAME_TAKEN } });
      return;
    }

    const row = await indicators.findById(created.indicatorId);

    if (!row) throw new Error('the indicator just created could not be read back');

    response.status(201).json(toDetail(row));
  });

  router.patch('/api/internal/indicators/:id', requirePublisher, async (request, response) => {
    const id = indicatorIdSchema.safeParse(request.params.id);

    if (!id.success) {
      response.status(400).json({ error: 'invalid_id' });
      return;
    }

    // Validated here as well as at the form: the API is reachable without going through it.
    const submission = indicatorNameSchema.safeParse(request.body);

    if (!submission.success) {
      response
        .status(400)
        .json({ error: 'validation_failed', fieldErrors: toFieldErrors(submission.error) });
      return;
    }

    const { sub } = requireApiSession(response);
    // No memberships: the repository leaves the ones it is not given alone.
    const result = await indicators.updateDraft(id.data, submission.data, {}, sub);
    const row = await indicators.findById(id.data);

    if (!row) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    if (!result.ok) {
      if (result.reason === 'slug_taken') {
        response.status(409).json({ error: 'slug_taken', fieldErrors: { name: NAME_TAKEN } });
        return;
      }

      // The indicator is there, so the update found no draft to write: a published indicator
      // is edited by opening a draft first.
      response.status(409).json({ error: 'no_draft' });
      return;
    }

    response.status(200).json(toDetail(row));
  });

  router.get('/api/internal/indicators/:id', requirePublisher, async (request, response) => {
    const id = indicatorIdSchema.safeParse(request.params.id);

    // Handing an unparseable id to the database would surface as a 500; it is a bad request.
    if (!id.success) {
      response.status(400).json({ error: 'invalid_id' });
      return;
    }

    const row = await indicators.findById(id.data);

    if (!row) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    response.status(200).json(toDetail(row));
  });

  return router;
}
