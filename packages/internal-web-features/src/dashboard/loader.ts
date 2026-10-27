// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import { canAssignReviewers, canCreateIndicator } from '@fphd/auth/permissions';
import {
  indicatorAdminPageSchema,
  indicatorPageQuerySchema,
  indicatorsUnderReviewSchema,
} from '@fphd/internal-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { getSession } from '@fphd/web-server/session';
import type { LoaderFunctionArgs } from 'react-router';

import { queryObject } from '../query-object.ts';

export type {
  IndicatorAdminListItem,
  IndicatorsUnderReview,
} from '@fphd/internal-api-features/contract';

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

async function loadIndicatorList(api: ApiClient, page: number, ownTeams: boolean) {
  const teams = ownTeams ? '&teams=own' : '';
  const { indicators, pageSize, total } = await api.get(
    `/api/internal/indicators?page=${page}${teams}`,
    indicatorAdminPageSchema,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (page > totalPages) throw notFound();

  return { indicators, page, totalPages };
}

/**
 * An IMRG manager sees the indicators under review, anyone else a page of the indicators they
 * work on, and a manager who also publishes both. A page that cannot exist is a 404, like any
 * other address that names nothing.
 */
export async function loadDashboard({ context, request }: LoaderFunctionArgs) {
  const query = indicatorPageQuerySchema.safeParse(queryObject(new URL(request.url).searchParams));

  if (!query.success) throw notFound();

  const session = getSession(context);
  const reviewing = session !== undefined && canAssignReviewers(session);
  const canCreate = session !== undefined && canCreateIndicator(session);
  const listing = !reviewing || canCreate;
  const { page } = query.data;

  if (!listing && page > 1) throw notFound();

  const api = context.get(apiContext);
  const [underReview, list] = await Promise.all([
    reviewing
      ? api.get('/api/internal/indicators-under-review', indicatorsUnderReviewSchema)
      : null,
    listing ? loadIndicatorList(api, page, reviewing) : null,
  ]);

  return {
    underReview,
    list: list === null ? null : { canCreate, ...list },
  };
}
