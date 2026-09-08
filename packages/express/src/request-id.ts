import type { IncomingMessage } from 'node:http';

import { validate as isUuid, version as uuidVersion, v7 as uuidv7 } from 'uuid';

/** Carried from a web app to the API it calls, so one page load is one id in both logs. Not
 * X-Request-Id: the Container Apps ingress replaces that one with an id of its own. */
export const REQUEST_ID_HEADER = 'x-fphd-request-id';

export { uuidv7 };

/** The id a caller sent, if it is one we would have minted; anything else is a stray or hostile header. */
export function readRequestIdHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && isUuid(value) && uuidVersion(value) === 7
    ? value.toLowerCase()
    : undefined;
}

/** The id the request logger assigned, for passing on to a downstream call. */
export function requestId(request: IncomingMessage): string | undefined {
  const { id } = request as { id?: unknown };
  return typeof id === 'string' ? id : undefined;
}
