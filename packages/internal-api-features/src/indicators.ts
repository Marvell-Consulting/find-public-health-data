import { requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';

import {
  type IndicatorAdminPage,
  type IndicatorAdminSummary,
  indicatorPageQuerySchema,
} from './contract.js';
import type { IndicatorAdminRow } from './indicator-repository.js';
import type { InternalIndicatorRepository } from './repositories.js';

export const INDICATORS_PAGE_SIZE = 10;

function toSummary({ id, name, updatedAt }: IndicatorAdminRow): IndicatorAdminSummary {
  return { id, name, updatedAt: updatedAt.toISOString() };
}

/**
 * The publisher's dashboard listing: every indicator, including the unapproved ones the
 * public API never serves. Mounted only by `internal-api`; `public-api` must 404 every path.
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

  return router;
}
