import { backLinkHandle, createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { DASHBOARD_PATH } from '../dashboard/paths.ts';
import { loadIndicatorOverview } from './loader.ts';
import { IndicatorOverviewPage } from './page.tsx';

export const loader = loadIndicatorOverview;

export const meta = createDocumentMeta('Indicator overview');

export const handle = backLinkHandle(DASHBOARD_PATH);

export function IndicatorOverviewRoute() {
  const { indicator } = useLoaderData<typeof loader>();
  return <IndicatorOverviewPage indicator={indicator} />;
}

export default IndicatorOverviewRoute;
