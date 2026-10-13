import { createDocumentMeta } from '@fphd/ui';
import { type ShouldRevalidateFunctionArgs, useLoaderData } from 'react-router';
import { loadTopics } from './loader.ts';
import { TopicsPage } from './pages.tsx';

export const loader = loadTopics;

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (
    currentUrl.pathname !== nextUrl.pathname ||
    currentUrl.searchParams.get('q') === nextUrl.searchParams.get('q')
  ) {
    return defaultShouldRevalidate;
  }
  const remainingParams = (url: URL) => {
    const params = new URLSearchParams(url.search);
    params.delete('q');
    return params.toString();
  };
  return remainingParams(currentUrl) === remainingParams(nextUrl) ? false : defaultShouldRevalidate;
}

export const meta = createDocumentMeta('Topics');

export function TopicsRoute() {
  const topics = useLoaderData<typeof loader>();
  return <TopicsPage topics={topics} />;
}

export default TopicsRoute;
