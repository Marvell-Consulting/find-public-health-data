import { z } from '@fphd/config/zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiPath, createApiClient } from './api-client.js';

const schema = z.array(z.object({ slug: z.string() }));

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
