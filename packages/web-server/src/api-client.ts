import { readCookie } from '@fphd/auth/cookies';
import type { z } from '@fphd/config/zod';

export interface ApiClientOptions {
  baseUrl: string;
  /** Sent with every request — the internal app forwards its session cookie this way. */
  headers?: Record<string, string>;
  /** Abort and fail rather than hold a page render open indefinitely. */
  timeoutMs?: number;
}

export type ApiWriteResult<T, E> = { ok: true; data: T } | { ok: false; status: number; error: E };

export interface ApiClient {
  /**
   * GET `path`, parse the body with `schema`, and return the result. A 404 is rethrown as a
   * 404 `Response` so a route's not-found boundary renders; any other non-2xx becomes a 502,
   * because a failure inside the API is not the browser's fault.
   */
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;

  /**
   * PUT `body` to `path`. A 400 or 409 comes back as a value parsed with `errorSchema`, for a
   * form to render. A 404 throws for the not-found boundary; anything else, including a 401 or
   * 403 the route middleware should have refused first, is a 502.
   */
  put<T, E>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    errorSchema: z.ZodType<E>,
  ): Promise<ApiWriteResult<T, E>>;

  /** POST `body` to create. As `put`, minus the 404 case: the collection always exists. */
  post<T, E>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    errorSchema: z.ZodType<E>,
  ): Promise<ApiWriteResult<T, E>>;

  /** DELETE `path`. A 204 has no body; a 404 throws for the not-found boundary, the rest 502. */
  delete(path: string): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** A `Cookie` header carrying only the named cookie, so the API never sees the browser's others. */
export function forwardedCookieHeaders(
  cookieHeader: string | null | undefined,
  cookieName: string,
): Record<string, string> {
  const value = readCookie(cookieHeader, cookieName);

  return value === undefined ? {} : { cookie: `${cookieName}=${value}` };
}

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

/**
 * The API answered with a shape this app does not understand. Failing here keeps the mismatch
 * at the boundary instead of rendering undefined fields down the page.
 */
function parseOrFail<T>(path: string, schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new Response(`Unexpected response from ${path}`, { status: 502 });
  }

  return result.data;
}

/** A non-JSON body (an ingress error page, an empty 200) fails the same way as a shape mismatch. */
async function readJson(path: string, response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Response(`Unexpected response from ${path}`, { status: 502 });
  }
}

export function createApiClient({
  baseUrl,
  headers = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions): ApiClient {
  return {
    async get(path, schema) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 404) {
        throw new Response('Not Found', { status: 404 });
      }

      if (!response.ok) {
        throw new Response('Bad Gateway', { status: 502 });
      }

      return parseOrFail(path, schema, await readJson(path, response));
    },

    async put(path, body, schema, errorSchema) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 404) {
        throw new Response('Not Found', { status: 404 });
      }

      if (response.status === 400 || response.status === 409) {
        return {
          ok: false,
          status: response.status,
          error: parseOrFail(path, errorSchema, await readJson(path, response)),
        };
      }

      if (!response.ok) {
        throw new Response('Bad Gateway', { status: 502 });
      }

      return { ok: true, data: parseOrFail(path, schema, await readJson(path, response)) };
    },

    async post(path, body, schema, errorSchema) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 400 || response.status === 409) {
        return {
          ok: false,
          status: response.status,
          error: parseOrFail(path, errorSchema, await readJson(path, response)),
        };
      }

      if (!response.ok) {
        throw new Response('Bad Gateway', { status: 502 });
      }

      return { ok: true, data: parseOrFail(path, schema, await readJson(path, response)) };
    },

    async delete(path) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 404) {
        throw new Response('Not Found', { status: 404 });
      }

      if (!response.ok) {
        throw new Response('Bad Gateway', { status: 502 });
      }
    },
  };
}
