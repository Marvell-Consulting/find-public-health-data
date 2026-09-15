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

// A repeated key becomes an array, as Express parses it, so the schema rejects it here too.
function queryObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  return Object.fromEntries(
    [...new Set(searchParams.keys())].map((key) => {
      const values = searchParams.getAll(key);
      return [key, values.length === 1 ? (values[0] ?? '') : values];
    }),
  );
}

/** A page that cannot exist is a 404, like any other address that names nothing. */
export async function loadDashboard({ context, request }: LoaderFunctionArgs) {
  const query = indicatorPageQuerySchema.safeParse(queryObject(new URL(request.url).searchParams));

  if (!query.success) throw notFound();

  const { indicators, page, pageSize, total } = await context
    .get(apiContext)
    .get(`/api/internal/indicators?page=${query.data.page}`, indicatorAdminPageSchema);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (page > totalPages) throw notFound();

  return { indicators, page, totalPages };
}
