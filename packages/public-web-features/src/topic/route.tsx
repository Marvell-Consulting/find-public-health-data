import { formatDocumentTitle } from '@fphd/ui';
import { type MetaFunction, type ShouldRevalidateFunctionArgs, useLoaderData } from 'react-router';
import { loadTopic } from './loader.ts';
import { TopicPage } from './page.tsx';

export const loader = loadTopic;

export function shouldRevalidate({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  const key = (url: URL) => {
    const params = new URLSearchParams(url.search);
    params.delete('columns-topic');
    return `${url.pathname}?${params}`;
  };
  return key(currentUrl) !== key(nextUrl);
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => [
  { title: formatDocumentTitle(loaderData?.topic.title ?? 'Topic') },
];

export function TopicRoute() {
  const data = useLoaderData<typeof loader>();
  return <TopicPage {...data} />;
}

export default TopicRoute;
