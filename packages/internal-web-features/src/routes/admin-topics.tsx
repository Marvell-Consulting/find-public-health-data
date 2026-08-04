import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { AdminTopicsPage } from '../topic-admin-pages';
import { loadAdminTopics } from '../topics-admin-loader';

export const loader = loadAdminTopics;

export const meta = createDocumentMeta('Manage topics');

export function AdminTopicsRoute() {
  const { topics } = useLoaderData<typeof loader>();
  return <AdminTopicsPage topics={topics} />;
}

export default AdminTopicsRoute;
