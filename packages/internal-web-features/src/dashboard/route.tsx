import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadDashboard } from './loader';
import { DashboardPage } from './page';

export const loader = loadDashboard;

export const meta = createDocumentMeta('Indicators');

export function DashboardRoute() {
  const { indicators, page, totalPages } = useLoaderData<typeof loader>();
  return <DashboardPage indicators={indicators} page={page} totalPages={totalPages} />;
}

export default DashboardRoute;
