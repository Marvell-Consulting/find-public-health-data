import type { IncomingMessage } from 'node:http';

import { REQUEST_ID_HEADER, requestId } from '@fphd/express';

// Kept apart from the API client, which loaders share with the browser: this reaches express.

/** The page request's id, so the API logs its call under the same one. Empty when unlogged. */
export function forwardedRequestIdHeaders(request: IncomingMessage): Record<string, string> {
  const id = requestId(request);

  return id === undefined ? {} : { [REQUEST_ID_HEADER]: id };
}
