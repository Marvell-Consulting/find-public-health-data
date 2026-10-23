// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import { canEditIndicator } from '@fphd/auth/permissions';
import { indicatorAdminDetailSchema } from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { getSession } from '@fphd/web-server/session';
import type { LoaderFunctionArgs } from 'react-router';

import { requireIndicatorId } from '../indicator-id.ts';

export type { IndicatorAdminDetail } from '@fphd/internal-api-features/contract';

export async function loadIndicatorOverview({ context, params }: LoaderFunctionArgs) {
  const id = requireIndicatorId(params);
  const indicator = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id}`, indicatorAdminDetailSchema);

  const session = getSession(context);

  return { canEdit: session !== undefined && canEditIndicator(session, indicator), indicator };
}
