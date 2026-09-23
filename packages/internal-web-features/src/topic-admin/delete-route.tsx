import { backLinkHandle, createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { deleteTopic, loadAdminTopicToDelete } from './loader.ts';
import { DeleteTopicPage } from './pages.tsx';
import { editTopicPath } from './paths.ts';

export const loader = loadAdminTopicToDelete;
export const action = deleteTopic;

export const meta = createDocumentMeta('Delete topic');

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ topic }) =>
  editTopicPath(topic.id),
);

export function DeleteTopicRoute() {
  const { topic } = useLoaderData<typeof loader>();
  return <DeleteTopicPage topic={topic} />;
}

export default DeleteTopicRoute;
