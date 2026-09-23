import { requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';

import {
  type IndicatorAdminDetail,
  type IndicatorAdminPage,
  type IndicatorAdminSummary,
  indicatorIdSchema,
  indicatorPageQuerySchema,
} from './contract.ts';
import type { IndicatorAdminDetailRow, IndicatorAdminRow } from './indicator-repository.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

export const INDICATORS_PAGE_SIZE = 10;

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
