import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { deleteTopic, loadTopicToDelete } from './loader';
import { DeleteTopicPage } from './pages';

export const loader = loadTopicToDelete;
export const action = deleteTopic;

export const meta = createDocumentMeta('Delete topic');

export function DeleteTopicRoute() {
  const { topic } = useLoaderData<typeof loader>();
  return <DeleteTopicPage topic={topic} />;
}

export default DeleteTopicRoute;
