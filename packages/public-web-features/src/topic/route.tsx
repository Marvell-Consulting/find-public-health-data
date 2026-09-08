import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadTopic } from './loader';
import { TopicPage } from './pages';

export const loader = loadTopic;

export const meta = createDocumentMeta('Topic');

export function TopicRoute() {
  const topic = useLoaderData<typeof loader>();
  return <TopicPage topic={topic} />;
}

export default TopicRoute;
