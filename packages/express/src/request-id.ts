import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

/** Carried from a web app to the API it calls, so one page load is one id in both logs. */
export const REQUEST_ID_HEADER = 'x-request-id';

// Only this shape is accepted from a caller; anything else is a stray or hostile header.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** RFC 9562 UUIDv7: a millisecond timestamp then random bits, so ids sort by time. */
export function uuidv7(now = Date.now()): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(now, 0, 6);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The id a caller sent, if it is one we would have minted ourselves. */
export function readRequestIdHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value.toLowerCase() : undefined;
}

/** The id the request logger assigned, for passing on to a downstream call. */
export function requestId(request: IncomingMessage): string | undefined {
  const { id } = request as { id?: unknown };
  return typeof id === 'string' ? id : undefined;
}
