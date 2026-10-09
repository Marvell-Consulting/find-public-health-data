import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import { Agent, type Dispatcher, RetryAgent, request } from 'undici';

export interface DownloadResume {
  attempt: number;
  bytes: number;
  error: unknown;
}
export interface DownloadOptions {
  attempts?: number;
  retryDelayMs?: number;
  onResume?: ((resume: DownloadResume) => void) | undefined;
  dispatcher?: Dispatcher;
}
class RestartDownload extends Error {}
const redirects = new Set([301, 302, 303, 307, 308]);

export async function downloadFile(
  url: string,
  path: string,
  label: string,
  { attempts = 5, retryDelayMs = 2_000, onResume, dispatcher }: DownloadOptions = {},
): Promise<void> {
  if (new URL(url).protocol !== 'https:') throw new Error(`${label} URL must use HTTPS`);
  const agent = dispatcher ?? new Agent();
  let current = new URL(url);
  let redirectsFollowed = 0;
  let used = 0;
  let received = 0;
  let etag: string | undefined;
  let lastError: unknown;
  try {
    while (used < attempts) {
      const tracked = agent.compose((dispatch) => (options, handler) => {
        const headers = options.headers as Record<string, string> | undefined;
        // A weak or absent validator cannot pin a resumed representation; restart it whole.
        if (headers?.range && !etag) throw new RestartDownload();
        used += 1;
        if (lastError) onResume?.({ attempt: used - 1, bytes: received, error: lastError });
        let status = 0;
        return dispatch(options, {
          onRequestStart: (controller, context) => handler.onRequestStart?.(controller, context),
          onResponseStart(controller, code, responseHeaders, message) {
            status = code;
            if (code === 200) {
              const value = responseHeaders.etag;
              if (typeof value === 'string' && !value.startsWith('W/')) etag ??= value;
              if (!headers?.range) received = 0;
            }
            if (code >= 400) lastError = new Error(`${label} download returned HTTP ${code}`);
            handler.onResponseStart?.(controller, code, responseHeaders, message);
          },
          onResponseData(controller, chunk) {
            if (status === 200 || status === 206) received += chunk.length;
            handler.onResponseData?.(controller, chunk);
          },
          onResponseEnd: (controller, trailers) => handler.onResponseEnd?.(controller, trailers),
          onResponseError(controller, error) {
            lastError = error;
            handler.onResponseError?.(controller, error);
          },
        });
      });
      const retry = new RetryAgent(tracked, {
        maxRetries: attempts - used - 1,
        minTimeout: retryDelayMs,
      });
      try {
        const response = await request(current, {
          dispatcher: retry,
          method: 'GET',
          headers: { 'accept-encoding': 'identity', ...(etag ? { 'if-match': etag } : {}) },
        });
        if (redirects.has(response.statusCode)) {
          await response.body.dump();
          if (++redirectsFollowed > 5 || typeof response.headers.location !== 'string') {
            throw new Error(`${label} download has an invalid redirect`);
          }
          current = new URL(response.headers.location, current);
          if (current.protocol !== 'https:')
            throw new Error(`${label} download redirected away from HTTPS`);
          etag = undefined;
          lastError = undefined;
          used -= 1;
          continue;
        }
        if (response.statusCode !== 200) {
          await response.body.dump();
          throw new Error(
            response.statusCode === 412
              ? `${label} changed during download`
              : `${label} download returned HTTP ${response.statusCode}`,
          );
        }
        await pipeline(response.body, createWriteStream(path));
        return;
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? error.statusCode
            : undefined;
        if (statusCode === 412)
          throw new Error(`${label} changed during download`, { cause: error });
        if ((error instanceof RestartDownload || statusCode === 200) && used < attempts) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw new Error(`${label} download exhausted its attempts`, { cause: lastError });
  } finally {
    if (!dispatcher) await agent.close();
  }
}
