// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import {
  indicatorAdminDetailSchema,
  indicatorIdSchema,
} from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

export type { IndicatorAdminDetail, IndicatorStatus } from '@fphd/internal-api-features/contract';

/** An address that is not an id names nothing, so it is a 404 rather than an API error. */
export async function loadIndicatorOverview({ context, params }: LoaderFunctionArgs) {
  const id = indicatorIdSchema.safeParse(params.id);

  if (!id.success) throw new Response('Not Found', { status: 404 });

  const indicator = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id.data}`, indicatorAdminDetailSchema);

  return { indicator };
}
