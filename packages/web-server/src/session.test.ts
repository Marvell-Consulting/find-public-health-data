import type { RouterContextProvider, SessionStorage } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createWebSessionStorage } from './react-router-app.js';
import { createSessionContext, getSession, sessionMiddleware } from './session.js';

const sessionSecret = 'a-session-secret-that-is-long-enough-for-tests';

interface RunSessionMiddlewareOptions {
  cookie?: string;
  handle: (context: RouterContextProvider) => void | Promise<void>;
  response?: Response;
  storage: SessionStorage;
}

async function runSessionMiddleware({
  cookie,
  handle,
  response = new Response('OK'),
  storage,
}: RunSessionMiddlewareOptions): Promise<Response> {
  const context = createSessionContext(storage);
  const request = new Request('https://example.test/', {
    ...(cookie === undefined ? {} : { headers: { Cookie: cookie } }),
  });
  const url = new URL(request.url);

  const result = await sessionMiddleware(
    { context, params: {}, pattern: '/', request, url },
    async () => {
      await handle(context);
      return response;
    },
  );

  if (!(result instanceof Response)) {
    throw new Error('Session middleware did not return a response');
  }

  return result;
}

function createTestStorage(secure = false): SessionStorage {
  return createWebSessionStorage({
    cookieName: 'fphd-test-session',
    secret: sessionSecret,
    secure,
  });
}

function requestCookie(setCookie: string): string {
  const [cookie] = setCookie.split(';', 1);

  if (cookie === undefined) {
    throw new Error('Set-Cookie header did not contain a cookie');
  }

  return cookie;
}

describe('web session storage', () => {
  it.each([undefined, '', '   '])('requires a session secret', (secret) => {
    expect(() => createWebSessionStorage({ cookieName: 'test', secret, secure: false })).toThrow(
      'SESSION_SECRET is required',
    );
  });

  it('requires a sufficiently long session secret', () => {
    expect(() =>
      createWebSessionStorage({ cookieName: 'test', secret: 'too-short', secure: false }),
    ).toThrow('SESSION_SECRET must be at least 32 bytes');
  });

  it('uses secure, HTTP-only, same-site cookies in production', async () => {
    const response = await runSessionMiddleware({
      handle: (context) => getSession(context).set('key', 'value'),
      storage: createTestStorage(true),
    });

    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(response.headers.get('Set-Cookie')).toContain('Path=/');
    expect(response.headers.get('Set-Cookie')).toContain('SameSite=Lax');
    expect(response.headers.get('Set-Cookie')).toContain('Secure');
  });
});

describe('React Router session middleware', () => {
  it('does not create a cookie for an untouched anonymous session', async () => {
    const response = await runSessionMiddleware({
      handle: () => undefined,
      storage: createTestStorage(),
    });

    expect(response.headers.has('Set-Cookie')).toBe(false);
  });

  it('persists mutations and exposes them on the next request', async () => {
    const storage = createTestStorage();
    const firstResponse = await runSessionMiddleware({
      handle: (context) => getSession(context).set('returnTo', '/manage'),
      storage,
    });
    const setCookie = firstResponse.headers.get('Set-Cookie');

    expect(setCookie).not.toBeNull();

    const secondResponse = await runSessionMiddleware({
      cookie: requestCookie(setCookie ?? ''),
      handle: (context) => {
        expect(getSession(context).get('returnTo')).toBe('/manage');
      },
      storage,
    });

    expect(secondResponse.headers.has('Set-Cookie')).toBe(false);
  });

  it('persists consumed flash data without route-specific cookie headers', async () => {
    const storage = createTestStorage();
    const flashResponse = await runSessionMiddleware({
      handle: (context) => getSession(context).flash('notice', 'Saved'),
      storage,
    });
    const flashCookie = requestCookie(flashResponse.headers.get('Set-Cookie') ?? '');
    const consumeResponse = await runSessionMiddleware({
      cookie: flashCookie,
      handle: (context) => {
        expect(getSession(context).get('notice')).toBe('Saved');
      },
      storage,
    });
    const consumedCookie = requestCookie(consumeResponse.headers.get('Set-Cookie') ?? '');

    await runSessionMiddleware({
      cookie: consumedCookie,
      handle: (context) => {
        expect(getSession(context).get('notice')).toBeUndefined();
      },
      storage,
    });
  });

  it('destroys a persisted session', async () => {
    const storage = createTestStorage();
    const createResponse = await runSessionMiddleware({
      handle: (context) => getSession(context).set('userId', 'user-1'),
      storage,
    });
    const sessionCookie = requestCookie(createResponse.headers.get('Set-Cookie') ?? '');
    const destroyResponse = await runSessionMiddleware({
      cookie: sessionCookie,
      handle: (context) => getSession(context).destroy(),
      storage,
    });
    const destroyedSetCookie = destroyResponse.headers.get('Set-Cookie') ?? '';

    expect(destroyedSetCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');

    await runSessionMiddleware({
      cookie: requestCookie(destroyedSetCookie),
      handle: (context) => {
        expect(getSession(context).has('userId')).toBe(false);
      },
      storage,
    });
  });

  it('adds its cookie alongside headers returned by route handlers', async () => {
    const response = await runSessionMiddleware({
      handle: (context) => getSession(context).set('key', 'value'),
      response: new Response(null, {
        headers: { 'Set-Cookie': 'route-cookie=value; Path=/' },
        status: 500,
      }),
      storage: createTestStorage(),
    });

    expect(response.status).toBe(500);
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.getSetCookie()[0]).toBe('route-cookie=value; Path=/');
    expect(response.headers.getSetCookie()[1]).toContain('fphd-test-session=');
  });
});
