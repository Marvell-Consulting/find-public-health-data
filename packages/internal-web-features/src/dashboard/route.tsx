import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadDashboard } from './loader.ts';
import { DashboardPage } from './page.tsx';

export const loader = loadDashboard;

export const meta = createDocumentMeta('Indicators');

export function DashboardRoute() {
  const { underReview, list } = useLoaderData<typeof loader>();
  return <DashboardPage underReview={underReview} list={list} />;
}

export default DashboardRoute;
