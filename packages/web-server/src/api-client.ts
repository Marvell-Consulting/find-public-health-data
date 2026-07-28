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
 */
export function apiPath(strings: TemplateStringsArray, ...segments: (string | undefined)[]) {
  return strings.reduce(
    (path, literal, index) =>
      index === 0 ? literal : `${path}${encodeURIComponent(segments[index - 1] ?? '')}${literal}`,
    '',
  );
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
