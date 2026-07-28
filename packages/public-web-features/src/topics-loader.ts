import { topicDetailSchema, topicSummaryListSchema } from '@fphd/public-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

export type { TopicDetail, TopicSummary } from '@fphd/public-api-features/contract';

/**
 * Kept free of any @fphd/ui import so it can be unit-tested without the jsdom/SSR
 * environment the GOV.UK component library needs.
 */
export async function loadTopics({ context }: LoaderFunctionArgs) {
  return context.get(apiContext).get('/api/topics', topicSummaryListSchema);
}

/**
 * The client turns the API's 404 into a thrown 404 Response, so React Router renders the
 * nearest not-found boundary instead of the page component. It also encodes the slug —
 * React Router decodes %2F inside a single dynamic segment, so an un-encoded slug of
 * '../internal' would normalise the request onto a different API route entirely.
 */
export async function loadTopic({ context, params }: LoaderFunctionArgs) {
  return context.get(apiContext).get(apiPath`/api/topics/${params.slug}`, topicDetailSchema);
}
