import type { z } from '@fphd/config/zod';

export interface ApiClientOptions {
  baseUrl: string;
  /** Abort and fail rather than hold a page render open indefinitely. */
  timeoutMs?: number;
}

export interface ApiClient {
  /**
   * GET `path`, parse the body with `schema`, and return the result. A 404 is rethrown as a
   * 404 `Response` so a route's not-found boundary renders; any other non-2xx becomes a 502,
   * because a failure inside the API is not the browser's fault.
   */
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Path segments are encoded here so no caller can interpolate one raw. React Router decodes
 * `%2F` inside a single dynamic segment, so an un-encoded slug of `../internal` would
 * normalise the request onto a different API route entirely.
 *
 * An empty segment is rejected rather than tolerated: it silently changes which route the
 * path addresses — `/api/topics/` is the collection, not a member — and it does so wherever
 * it appears, not only at the end, so a trailing slash is not a signal a caller could check
 * for. The parameter type keeps this out of reach at compile time; the throw is for callers
 * whose types have been erased.
 */
export function apiPath(strings: TemplateStringsArray, ...segments: string[]) {
  return strings.reduce((path, literal, index) => {
    if (index === 0) {
      return literal;
    }

    const segment = segments[index - 1];
    if (segment === undefined || segment === '') {
      throw new Error(
        `apiPath: segment ${index} is empty, which would address a different route than intended`,
      );
    }

    return `${path}${encodeURIComponent(segment)}${literal}`;
  }, '');
}

export function createApiClient({
  baseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions): ApiClient {
  return {
    async get(path, schema) {
      const response = await fetch(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 404) {
        throw new Response('Not Found', { status: 404 });
      }

      if (!response.ok) {
        throw new Response('Bad Gateway', { status: 502 });
      }

      const result = schema.safeParse(await response.json());

      if (!result.success) {
        // The API answered with a shape this app does not understand. Failing here keeps the
        // mismatch at the boundary instead of rendering undefined fields down the page.
        throw new Response(`Unexpected response from ${path}`, { status: 502 });
      }

      return result.data;
    },
  };
}
