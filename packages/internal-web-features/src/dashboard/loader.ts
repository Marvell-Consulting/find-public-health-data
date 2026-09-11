// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import {
  indicatorAdminPageSchema,
  indicatorPageQuerySchema,
} from '@fphd/internal-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

export type { IndicatorAdminSummary } from '@fphd/internal-api-features/contract';

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

/** A page that cannot exist is a 404, like any other address that names nothing. */
export async function loadDashboard({ context, request }: LoaderFunctionArgs) {
  const query = indicatorPageQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!query.success) throw notFound();

  const { indicators, page, pageSize, total } = await context
    .get(apiContext)
    .get(`/api/internal/indicators?page=${query.data.page}`, indicatorAdminPageSchema);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (page > totalPages) throw notFound();

  return { indicators, page, totalPages };
}
