import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadTopics } from './loader';
import { TopicsPage } from './pages';

export const loader = loadTopics;

export const meta = createDocumentMeta('Topics');

export function TopicsRoute() {
  const topics = useLoaderData<typeof loader>();
  return <TopicsPage topics={topics} />;
}

export default TopicsRoute;
