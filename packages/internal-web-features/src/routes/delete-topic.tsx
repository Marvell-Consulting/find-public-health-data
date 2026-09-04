import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { DeleteTopicPage } from '../topic-admin-pages';
import { deleteTopic, loadTopicToDelete } from '../topics-admin-loader';

export const loader = loadTopicToDelete;
export const action = deleteTopic;

export const meta = createDocumentMeta('Delete topic');

export function DeleteTopicRoute() {
  const { topic } = useLoaderData<typeof loader>();
  return <DeleteTopicPage topic={topic} />;
}

export default DeleteTopicRoute;
