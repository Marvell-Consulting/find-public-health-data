import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

export interface TopicSummary {
  slug: string;
  title: string;
}

/**
 * Kept free of any @fphd/ui import so it can be unit-tested without the jsdom/SSR
 * environment the GOV.UK component library needs.
 */
export async function loadTopics({ context }: LoaderFunctionArgs): Promise<TopicSummary[]> {
  const { baseUrl } = context.get(apiContext);
  const response = await fetch(`${baseUrl}/api/topics`);

  if (!response.ok) {
    throw new Response('Failed to load topics', { status: response.status });
  }

  return (await response.json()) as TopicSummary[];
}
