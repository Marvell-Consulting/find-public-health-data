import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadAdminTopics } from './loader';
import { AdminTopicsPage } from './pages';

export const loader = loadAdminTopics;

export const meta = createDocumentMeta('Manage topics');

export function AdminTopicsRoute() {
  const { topics, notification } = useLoaderData<typeof loader>();
  return <AdminTopicsPage notification={notification} topics={topics} />;
}

export default AdminTopicsRoute;
