import type { IncomingMessage } from 'node:http';

import { v7 as uuidv7 } from 'uuid';

/** Carried from a web app to the API it calls, so one page load is one id in both logs. */
export const REQUEST_ID_HEADER = 'x-request-id';

// Only this shape is accepted from a caller; anything else is a stray or hostile header.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export { uuidv7 };

/** The id a caller sent, if it is one we would have minted ourselves. */
export function readRequestIdHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value.toLowerCase() : undefined;
}

/** The id the request logger assigned, for passing on to a downstream call. */
export function requestId(request: IncomingMessage): string | undefined {
  const { id } = request as { id?: unknown };
  return typeof id === 'string' ? id : undefined;
}
