import { formatDocumentTitle } from '@fphd/ui';
import { type MetaFunction, useLoaderData } from 'react-router';
import { loadTopic } from './loader.ts';
import { TopicPage } from './page.tsx';

export const loader = loadTopic;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => [
  { title: formatDocumentTitle(loaderData?.topic.title ?? 'Topic') },
];

export function TopicRoute() {
  const data = useLoaderData<typeof loader>();
  return <TopicPage {...data} />;
}

export default TopicRoute;
