import { RouterContextProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createFlashSessionStorage,
  flashMiddleware,
  setFlash,
  setFlashStorage,
  takeFlash,
} from './flash.js';

const storage = createFlashSessionStorage({
  audience: 'internal',
  secret: 'a-web-session-secret-that-is-long-enough-for-tests',
  secure: false,
});

interface RunOptions {
  cookie?: string;
  handle?: (context: RouterContextProvider) => void;
  /** Stands in for a route throwing a redirect rather than returning a response. */
  throws?: Response;
  response?: Response;
}

async function runFlashMiddleware({
  cookie,
  handle = () => {},
  throws,
  response = new Response('OK'),
}: RunOptions = {}): Promise<Response> {
  const context = new RouterContextProvider();
  setFlashStorage(context, storage);

  const request = new Request('https://example.test/manage/topics', {
    ...(cookie === undefined ? {} : { headers: { Cookie: cookie } }),
  });
  const args = { context, params: {}, pattern: '/', request, url: new URL(request.url) };

  const next = () => {
    handle(context);
    return throws === undefined ? Promise.resolve(response) : Promise.reject(throws);
  };

  try {
    const result = await flashMiddleware(args, next);

    if (!(result instanceof Response)) throw new Error('Flash middleware returned no response');
    return result;
  } catch (error) {
    if (throws !== undefined && error instanceof Response) return error;
    throw error;
  }
}

/** The cookie the browser would send back, taken from a `Set-Cookie` this middleware wrote. */
function cookieFrom(response: Response): string {
  const setCookie = response.headers.getSetCookie().at(-1);

  if (setCookie === undefined) throw new Error('No flash cookie was set');
  return setCookie.split(';', 1)[0] ?? '';
}

describe('flash middleware', () => {
  it('sets no cookie on a request that neither reads nor writes a message', async () => {
    const response = await runFlashMiddleware();

    expect(response.headers.has('Set-Cookie')).toBe(false);
  });

  it('exposes no message to a request that arrives without one', async () => {
    await runFlashMiddleware({
      handle: (context) => expect(takeFlash(context)).toBeUndefined(),
    });
  });

  it('carries a message across exactly one request, then forgets it', async () => {
    const written = await runFlashMiddleware({
      handle: (context) => setFlash(context, 'topic-updated'),
    });

    const first = await runFlashMiddleware({
      cookie: cookieFrom(written),
      handle: (context) => expect(takeFlash(context)).toBe('topic-updated'),
    });

    // Taking the message destroyed the cookie, so a browser honouring the response would not
    // send one again; this simulates one that does anyway.
    await runFlashMiddleware({
      cookie: cookieFrom(first),
      handle: (context) => expect(takeFlash(context)).toBeUndefined(),
    });
  });

  it('destroys the cookie on the response that takes the message', async () => {
    const written = await runFlashMiddleware({
      handle: (context) => setFlash(context, 'topic-updated'),
    });

    const taken = await runFlashMiddleware({
      cookie: cookieFrom(written),
      handle: (context) => takeFlash(context),
    });

    const setCookie = taken.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('fphd-internal-flash=;');
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });

  // Any request through the app runs this middleware — a second tab, a path falling through
  // to the catch-all. One of those must not eat the message the redirected page will show.
  it('leaves the message in place for a request that does not take it', async () => {
    const written = await runFlashMiddleware({
      handle: (context) => setFlash(context, 'topic-updated'),
    });

    const interleaved = await runFlashMiddleware({ cookie: cookieFrom(written) });

    expect(interleaved.headers.has('Set-Cookie')).toBe(false);

    await runFlashMiddleware({
      cookie: cookieFrom(written),
      handle: (context) => expect(takeFlash(context)).toBe('topic-updated'),
    });
  });

  it('commits the message onto a redirect thrown by a route', async () => {
    const response = await runFlashMiddleware({
      handle: (context) => setFlash(context, 'topic-updated'),
      throws: new Response(null, { status: 302, headers: { Location: '/manage/topics/1' } }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('Set-Cookie')).toContain('fphd-internal-flash=');
  });

  it('leaves cookies set by the route alone', async () => {
    const response = await runFlashMiddleware({
      handle: (context) => setFlash(context, 'topic-updated'),
      response: new Response(null, { headers: { 'Set-Cookie': 'route-cookie=value; Path=/' } }),
    });

    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.getSetCookie()[0]).toBe('route-cookie=value; Path=/');
  });

  it('scopes the cookie to the audience and keeps it off JavaScript', async () => {
    const response = await runFlashMiddleware({
      handle: (context) => setFlash(context, 'topic-updated'),
    });
    const setCookie = response.headers.get('Set-Cookie') ?? '';

    expect(setCookie).toContain('fphd-internal-flash=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
  });
});
