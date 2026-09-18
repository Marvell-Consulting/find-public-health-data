import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadAdminTopics } from './loader.ts';
import { AdminTopicsPage } from './pages.tsx';

export const loader = loadAdminTopics;

export const meta = createDocumentMeta('Manage topics');

export function AdminTopicsRoute() {
  const { topics, notification } = useLoaderData<typeof loader>();
  return <AdminTopicsPage notification={notification} topics={topics} />;
}

export default AdminTopicsRoute;
