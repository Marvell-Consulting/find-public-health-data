import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadIndicatorOverview } from './loader';
import { IndicatorOverviewPage } from './page';

export const loader = loadIndicatorOverview;

export const meta = createDocumentMeta('Indicator overview');

export function IndicatorOverviewRoute() {
  const { indicator } = useLoaderData<typeof loader>();
  return <IndicatorOverviewPage indicator={indicator} />;
}

export default IndicatorOverviewRoute;
