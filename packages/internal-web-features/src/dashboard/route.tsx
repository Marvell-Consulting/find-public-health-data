import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadDashboard } from './loader.ts';
import { DashboardPage } from './page.tsx';

export const loader = loadDashboard;

export const meta = createDocumentMeta('Indicators');

export function DashboardRoute() {
  const { canCreate, indicators, page, totalPages } = useLoaderData<typeof loader>();
  return (
    <DashboardPage
      canCreate={canCreate}
      indicators={indicators}
      page={page}
      totalPages={totalPages}
    />
  );
}

export default DashboardRoute;
