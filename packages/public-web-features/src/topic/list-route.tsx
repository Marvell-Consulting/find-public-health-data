import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData, useSearchParams } from 'react-router';
import { loadTopics } from './loader.ts';
import { TopicsPage } from './pages.tsx';

export const loader = loadTopics;

export const meta = createDocumentMeta('Topics');

export function TopicsRoute() {
  const topics = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  return <TopicsPage key={initialQuery} topics={topics} initialQuery={initialQuery} />;
}

export default TopicsRoute;
