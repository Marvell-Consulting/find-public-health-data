import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadTopic } from './loader.ts';
import { TopicPage } from './pages.tsx';

export const loader = loadTopic;

export const meta = createDocumentMeta('Topic');

export function TopicRoute() {
  const topic = useLoaderData<typeof loader>();
  return <TopicPage topic={topic} />;
}

export default TopicRoute;
