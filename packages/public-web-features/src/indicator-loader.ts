import { indicatorDetailSchema } from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

export type { IndicatorDetail } from '@fphd/public-api-features/contract';

/**
 * Kept free of any @fphd/ui import so it can be unit-tested without the jsdom/SSR
 * environment the GOV.UK component library needs. A non-numeric param is not rejected
 * here — the API answers it with a 404, which the client rethrows so the not-found
 * boundary renders, exactly as for an unknown indicator.
 */
export async function loadIndicator({ context, params }: LoaderFunctionArgs) {
  const { fingertipsId } = params;

  if (!fingertipsId) {
    // `indicators/:fingertipsId` cannot match without a segment, so reaching here means the
    // route table and this loader have drifted apart — a wiring bug, not a request the user
    // can make.
    throw new Error('loadIndicator expects a fingertipsId param; check the route that renders it');
  }

  return context
    .get(apiContext)
    .get(apiPath`/api/indicators/${fingertipsId}`, indicatorDetailSchema);
}
