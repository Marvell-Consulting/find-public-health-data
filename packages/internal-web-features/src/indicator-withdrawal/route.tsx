import { backLinkHandle, createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { indicatorOverviewPath } from '../indicator-overview/paths.ts';
import { loadIndicatorWithdrawal, withdrawSubmission } from './loader.ts';
import { IndicatorWithdrawalPage } from './page.tsx';

export const loader = loadIndicatorWithdrawal;

export const action = withdrawSubmission;

export const meta = createDocumentMeta('Are you sure you want to withdraw this submission?');

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(
  ({ id }) => indicatorOverviewPath(id),
  'Back to indicator overview',
);

export function IndicatorWithdrawalRoute() {
  return <IndicatorWithdrawalPage {...useLoaderData<typeof loader>()} />;
}

export default IndicatorWithdrawalRoute;
