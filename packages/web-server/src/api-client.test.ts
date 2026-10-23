import { z } from '@fphd/config/zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiConflictError,
  ApiTimeoutError,
  apiPath,
  createApiClient,
  forwardedCookieHeaders,
} from './api-client.ts';

const schema = z.array(z.object({ slug: z.string() }));
const topicSchema = z.object({ slug: z.string() });
const errorSchema = z.object({ error: z.string() });

function respondWith(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiPath', () => {
  it.each([
    ['../internal', '/api/topics/..%2Finternal'],
    ['../../health', '/api/topics/..%2F..%2Fhealth'],
    ['a topic', '/api/topics/a%20topic'],
    ['topic-a', '/api/topics/topic-a'],
  ])('encodes %s so a segment cannot traverse onto another route', (slug, expected) => {
    expect(apiPath`/api/topics/${slug}`).toBe(expected);

    // The guarantee that matters: whatever the segment, the path stays under /api/topics/.
    expect(new URL(`http://api${apiPath`/api/topics/${slug}`}`).pathname).toMatch(
      /^\/api\/topics\/./,
    );
  });

  it('keeps a whitespace-only segment, which is a slug the api can legitimately not find', () => {
    expect(apiPath`/api/topics/${' '}`).toBe('/api/topics/%20');
  });

  // The parameter type forbids these, so the casts stand in for a caller whose types have
  // been erased. Failing loudly beats addressing /api/topics — a different route entirely.
  it.each([
    ['undefined', undefined],
    ['empty', ''],
  ])('refuses an %s segment rather than silently changing the route', (_label, segment) => {
    expect(() => apiPath`/api/topics/${segment as string}`).toThrow(/segment 1 is empty/);
  });

  it('refuses an empty segment that is not the last one', () => {
    expect(() => apiPath`/api/${'' as string}/topics/${'topic-a'}`).toThrow(/segment 1 is empty/);
  });
});

describe('createApiClient', () => {
  it('returns the parsed body on success', async () => {
    respondWith([{ slug: 'a-topic' }]);

    const result = await createApiClient({ baseUrl: 'http://api:4000' }).get('/api/topics', schema);

    expect(result).toEqual([{ slug: 'a-topic' }]);
  });

  it('requests the path against the configured base url', async () => {
    const fetchMock = respondWith([]);

    await createApiClient({ baseUrl: 'http://api:4000' }).get('/api/topics', schema);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api:4000/api/topics');
  });

  it('passes a 404 through so a route can render its not-found boundary', async () => {
    respondWith({}, 404);

    await expect(
      createApiClient({ baseUrl: 'http://api:4000' }).get('/api/topics/nope', schema),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws a 409 as a conflict carrying the answer, for a caller that expects one', async () => {
    respondWith({ error: 'locked' }, 409);

    const read = createApiClient({ baseUrl: 'http://api:4000' }).get('/api/topics/a', schema);

    await expect(read).rejects.toBeInstanceOf(ApiConflictError);
    await expect(read).rejects.toMatchObject({ body: { error: 'locked' } });
  });

  it('turns any other api failure into a 502 rather than surfacing its status', async () => {
    respondWith({}, 500);

    await expect(
      createApiClient({ baseUrl: 'http://api:4000' }).get('/api/topics', schema),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('rejects a body that does not match the contract instead of returning it', async () => {
    respondWith([{ notASlug: true }]);

    await expect(
      createApiClient({ baseUrl: 'http://api:4000' }).get('/api/topics', schema),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('sends the configured headers with every request', async () => {
    const fetchMock = respondWith([]);

    await createApiClient({
      baseUrl: 'http://api:4000',
      headers: { cookie: 'fphd-internal-session=a-token' },
    }).get('/api/topics', schema);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { cookie: 'fphd-internal-session=a-token' },
    });
  });

  it('gives up on a request that never answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }),
    );

    await expect(
      createApiClient({ baseUrl: 'http://api:4000', timeoutMs: 5 }).get('/api/topics', schema),
    ).rejects.toThrow();
  });
});

describe('ApiClient.put', () => {
  function client(headers?: Record<string, string>) {
    return createApiClient({
      baseUrl: 'http://api:4000',
      ...(headers === undefined ? {} : { headers }),
    });
  }

  it('returns the parsed body on success', async () => {
    respondWith({ slug: 'a-topic' });

    const result = await client().put(
      '/api/internal/topics/1',
      { slug: 'a-topic' },
      topicSchema,
      errorSchema,
    );

    expect(result).toEqual({ ok: true, data: { slug: 'a-topic' } });
  });

  it('sends the body as JSON alongside the configured headers', async () => {
    const fetchMock = respondWith({ slug: 'a-topic' });

    await client({ cookie: 'fphd-internal-session=a-token' }).put(
      '/api/internal/topics/1',
      { slug: 'a-topic' },
      topicSchema,
      errorSchema,
    );

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      body: '{"slug":"a-topic"}',
      headers: { 'content-type': 'application/json', cookie: 'fphd-internal-session=a-token' },
    });
  });

  // A form has to render these against its fields; throwing would replace the page the
  // publisher is filling in with an error.
  it.each([400, 409])('returns a %s as a value rather than throwing', async (status) => {
    respondWith({ error: 'validation_failed' }, status);

    const result = await client().put('/api/internal/topics/1', {}, topicSchema, errorSchema);

    expect(result).toEqual({ ok: false, status, error: { error: 'validation_failed' } });
  });

  it('passes a 404 through so a route can render its not-found boundary', async () => {
    respondWith({}, 404);

    await expect(
      client().put('/api/internal/topics/1', {}, topicSchema, errorSchema),
    ).rejects.toMatchObject({ status: 404 });
  });

  // The route middleware already guaranteed the role, so an auth failure here is a
  // misconfiguration rather than something the form can express.
  it.each([401, 403, 500])('turns a %s into a 502', async (status) => {
    respondWith({}, status);

    await expect(
      client().put('/api/internal/topics/1', {}, topicSchema, errorSchema),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('rejects an error body that does not match the contract', async () => {
    respondWith({ unexpected: true }, 400);

    await expect(
      client().put('/api/internal/topics/1', {}, topicSchema, errorSchema),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe('ApiClient.patch', () => {
  function client(headers?: Record<string, string>) {
    return createApiClient({
      baseUrl: 'http://api:4000',
      ...(headers === undefined ? {} : { headers }),
    });
  }

  it('sends the body as JSON under the PATCH method and parses the answer', async () => {
    const fetchMock = respondWith({ slug: 'a-topic' });

    const result = await client({ cookie: 'fphd-internal-session=a-token' }).patch(
      '/api/internal/topics/1',
      { slug: 'a-topic' },
      topicSchema,
      errorSchema,
    );

    expect(result).toEqual({ ok: true, data: { slug: 'a-topic' } });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'PATCH',
      body: '{"slug":"a-topic"}',
      headers: { 'content-type': 'application/json', cookie: 'fphd-internal-session=a-token' },
    });
  });

  it.each([400, 409])('returns a %s as a value rather than throwing', async (status) => {
    respondWith({ error: 'validation_failed' }, status);

    const result = await client().patch('/api/internal/topics/1', {}, topicSchema, errorSchema);

    expect(result).toEqual({ ok: false, status, error: { error: 'validation_failed' } });
  });

  it('passes a 404 through so a route can render its not-found boundary', async () => {
    respondWith({}, 404);

    await expect(
      client().patch('/api/internal/topics/1', {}, topicSchema, errorSchema),
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each([401, 403, 500])('turns a %s into a 502', async (status) => {
    respondWith({}, status);

    await expect(
      client().patch('/api/internal/topics/1', {}, topicSchema, errorSchema),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe('ApiClient.post', () => {
  function client(headers?: Record<string, string>) {
    return createApiClient({
      baseUrl: 'http://api:4000',
      ...(headers === undefined ? {} : { headers }),
    });
  }

  it('returns the parsed body on a created resource', async () => {
    respondWith({ slug: 'a-topic' }, 201);

    const result = await client().post(
      '/api/internal/topics',
      { slug: 'a-topic' },
      topicSchema,
      errorSchema,
    );

    expect(result).toEqual({ ok: true, data: { slug: 'a-topic' } });
  });

  it('sends the body as JSON with the POST method and configured headers', async () => {
    const fetchMock = respondWith({ slug: 'a-topic' }, 201);

    await client({ cookie: 'fphd-internal-session=a-token' }).post(
      '/api/internal/topics',
      { slug: 'a-topic' },
      topicSchema,
      errorSchema,
    );

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: '{"slug":"a-topic"}',
      headers: { 'content-type': 'application/json', cookie: 'fphd-internal-session=a-token' },
    });
  });

  it.each([400, 409])('returns a %s as a value for the form to render', async (status) => {
    respondWith({ error: 'slug_taken' }, status);

    const result = await client().post('/api/internal/topics', {}, topicSchema, errorSchema);

    expect(result).toEqual({ ok: false, status, error: { error: 'slug_taken' } });
  });

  it.each([401, 403, 500])('turns a %s into a 502', async (status) => {
    respondWith({}, status);

    await expect(
      client().post('/api/internal/topics', {}, topicSchema, errorSchema),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe('ApiClient.postToMember', () => {
  function client() {
    return createApiClient({ baseUrl: 'http://api:4000', headers: { cookie: 'a=b' } });
  }

  it('resolves to success on a 204, sending the body as JSON', async () => {
    const fetchMock = respondWith(undefined, 204);

    const result = await client().postToMember('/api/internal/steps/1', { at: 1 }, errorSchema);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: '{"at":1}',
      headers: { 'content-type': 'application/json', cookie: 'a=b' },
    });
  });

  it.each([400, 409])('returns a %s as a refusal for the page to show', async (status) => {
    respondWith({ error: 'not_allowed' }, status);

    const result = await client().postToMember('/api/internal/steps/1', {}, errorSchema);

    expect(result).toEqual({ ok: false, status, error: { error: 'not_allowed' } });
  });

  it('passes a 404 through so a route can render its not-found boundary', async () => {
    respondWith({}, 404);

    await expect(
      client().postToMember('/api/internal/steps/1', {}, errorSchema),
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each([200, 401, 403, 500])('turns a %s into a 502', async (status) => {
    respondWith({}, status);

    await expect(
      client().postToMember('/api/internal/steps/1', {}, errorSchema),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe('ApiClient.delete', () => {
  function client(headers?: Record<string, string>) {
    return createApiClient({
      baseUrl: 'http://api:4000',
      ...(headers === undefined ? {} : { headers }),
    });
  }

  it('resolves without a body on a 204', async () => {
    respondWith(undefined, 204);

    await expect(client().delete('/api/internal/topics/1', errorSchema)).resolves.toEqual({
      ok: true,
      data: undefined,
    });
  });

  it('sends the DELETE method with the configured headers', async () => {
    const fetchMock = respondWith(undefined, 204);

    await client({ cookie: 'fphd-internal-session=a-token' }).delete(
      '/api/internal/topics/1',
      errorSchema,
    );

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'DELETE',
      headers: { cookie: 'fphd-internal-session=a-token' },
    });
  });

  it('returns a 409 as a value rather than throwing', async () => {
    respondWith({ error: 'in_use' }, 409);

    const result = await client().delete('/api/internal/topics/1', errorSchema);

    expect(result).toEqual({ ok: false, status: 409, error: { error: 'in_use' } });
  });

  it('rejects a 409 body that does not match the contract', async () => {
    respondWith({ unexpected: true }, 409);

    await expect(client().delete('/api/internal/topics/1', errorSchema)).rejects.toMatchObject({
      status: 502,
    });
  });

  it('passes a 404 through so a route can render its not-found boundary', async () => {
    respondWith({}, 404);

    await expect(client().delete('/api/internal/topics/1', errorSchema)).rejects.toMatchObject({
      status: 404,
    });
  });

  it.each([400, 401, 403, 500])('turns a %s into a 502', async (status) => {
    respondWith({}, status);

    await expect(client().delete('/api/internal/topics/1', errorSchema)).rejects.toMatchObject({
      status: 502,
    });
  });
});

describe('ApiClient.postStream', () => {
  const body = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('--b--\r\n'));
        controller.close();
      },
    });
  const contentType = 'multipart/form-data; boundary=b';

  function client() {
    return createApiClient({ baseUrl: 'http://api:4000', headers: { cookie: 'a=b' } });
  }

  it('sends the body as it arrives with its own content type and the configured headers', async () => {
    const fetchMock = respondWith({ slug: 'uploaded' }, 201);

    const result = await client().postStream(
      '/api/internal/uploads',
      { body: body(), contentType },
      topicSchema,
      errorSchema,
    );

    expect(result).toEqual({ ok: true, data: { slug: 'uploaded' } });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toMatchObject({
      method: 'POST',
      headers: { cookie: 'a=b', 'content-type': contentType },
      duplex: 'half',
    });
    expect(await new Response(init.body).text()).toBe('--b--\r\n');
  });

  it.each([400, 409, 422])('returns a %s as a refusal for the form to render', async (status) => {
    respondWith({ error: 'refused' }, status);

    await expect(
      client().postStream(
        '/api/internal/uploads',
        { body: body(), contentType },
        topicSchema,
        errorSchema,
      ),
    ).resolves.toEqual({ ok: false, status, error: { error: 'refused' } });
  });

  it('passes a 404 through so a route can render its not-found boundary', async () => {
    respondWith({}, 404);

    await expect(
      client().postStream(
        '/api/internal/uploads',
        { body: body(), contentType },
        topicSchema,
        errorSchema,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each([401, 413, 500])('turns a %s into a 502', async (status) => {
    respondWith({}, status);

    await expect(
      client().postStream(
        '/api/internal/uploads',
        { body: body(), contentType },
        topicSchema,
        errorSchema,
      ),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("abandons the API's request when the caller's signal aborts", async () => {
    const fetchMock = respondWith({ slug: 'uploaded' }, 201);
    const abandoned = new AbortController();

    await client().postStream(
      '/api/internal/uploads',
      { body: body(), contentType },
      topicSchema,
      errorSchema,
      abandoned.signal,
    );
    const signal: AbortSignal = fetchMock.mock.calls[0]?.[1].signal;
    abandoned.abort();

    expect(signal.aborted).toBe(true);
  });

  /** A fetch that answers only when its signal aborts, and reads the body when told to. */
  function hangingFetch() {
    let readBody: () => Promise<string> = async () => '';
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      readBody = () => new Response(init.body).text();
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return { readBody: () => readBody() };
  }

  it('times the answer from when the body has been sent, then gives up', async () => {
    vi.useFakeTimers();
    try {
      const { readBody } = hangingFetch();
      const outcome = createApiClient({ baseUrl: 'http://api:4000', uploadTimeoutMs: 1000 })
        .postStream(
          '/api/internal/uploads',
          { body: body(), contentType },
          topicSchema,
          errorSchema,
        )
        .catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(5000);
      let settled = false;
      void outcome.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);

      await readBody();
      await vi.advanceTimersByTimeAsync(1000);

      expect(await outcome).toBeInstanceOf(ApiTimeoutError);
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits 50 seconds by default, under Front Door’s 60', async () => {
    vi.useFakeTimers();
    try {
      const { readBody } = hangingFetch();
      const outcome = createApiClient({ baseUrl: 'http://api:4000', uploadTimeoutMs: undefined })
        .postStream(
          '/api/internal/uploads',
          { body: body(), contentType },
          topicSchema,
          errorSchema,
        )
        .catch((error: unknown) => error);
      await readBody();

      let settled = false;
      void outcome.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(49_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await outcome).toBeInstanceOf(ApiTimeoutError);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('forwardedCookieHeaders', () => {
  it('carries only the named cookie, not the rest of the browser header', () => {
    expect(
      forwardedCookieHeaders(
        'analytics=1; fphd-internal-session=a-token; other-service=secret',
        'fphd-internal-session',
      ),
    ).toEqual({ cookie: 'fphd-internal-session=a-token' });
  });

  it.each([
    ['no header', undefined],
    ['a header without the cookie', 'analytics=1'],
  ])('sends no cookie at all for %s', (_case, header) => {
    expect(forwardedCookieHeaders(header, 'fphd-internal-session')).toEqual({});
  });
});
