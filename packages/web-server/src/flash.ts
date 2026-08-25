import type { AppAudience } from '@fphd/auth';
import { readCookie } from '@fphd/auth/cookies';
import {
  createContext,
  createCookieSessionStorage,
  type MiddlewareFunction,
  type RouterContext,
  type RouterContextProvider,
} from 'react-router';

type FlashContextReader = {
  get<T>(context: RouterContext<T>): T;
};

/**
 * The one key this session holds. Messages are identifiers, not sentences: a page looks the
 * key up in its own copy, so nothing a user supplied can be echoed back through a cookie.
 */
const MESSAGE = 'message';

export interface FlashSessionOptions {
  audience: AppAudience;
  secret: string;
  secure: boolean;
}

export type FlashSessionStorage = ReturnType<typeof createFlashSessionStorage>;

/**
 * A cookie-backed store, kept behind this module so the whole of it can be swapped for a
 * Redis-backed one (React Router's `createSessionStorage` takes a custom backend) without any
 * call site changing. The cookie name rides alongside so the middleware can tell whether a
 * request carries the cookie at all before paying to unsign it.
 */
export function createFlashSessionStorage({ audience, secret, secure }: FlashSessionOptions) {
  const cookieName = `fphd-${audience}-flash`;

  return {
    cookieName,
    sessions: createCookieSessionStorage<Record<string, string>, Record<string, string>>({
      cookie: {
        name: cookieName,
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secrets: [secret],
        secure,
      },
    }),
  };
}

/**
 * A request-scoped mailbox. `read` is what arrived on the cookie; `taken` records that a
 * route actually collected it; `write` is what the action left for the next request, which
 * only the middleware can turn into a `Set-Cookie` — no route hand-rolls that header.
 */
interface RequestFlash {
  read: string | undefined;
  taken: boolean;
  write: string | undefined;
}

const flashStorageContext = createContext<FlashSessionStorage>();
const requestFlashContext = createContext<RequestFlash>();

export function setFlashStorage(
  context: RouterContextProvider,
  storage: FlashSessionStorage,
): void {
  context.set(flashStorageContext, storage);
}

/**
 * Reads the incoming message on the way in; on the way out, commits an outgoing message or
 * removes the cookie once a route has taken the incoming one.
 *
 * The cookie is only cleared when the message was taken. Every request through the app runs
 * this middleware — a second tab, a stray path falling through to the catch-all — and one of
 * those consuming the flash would eat the confirmation the redirected page was about to show.
 */
export const flashMiddleware: MiddlewareFunction<Response> = async ({ context, request }, next) => {
  const { cookieName, sessions } = context.get(flashStorageContext);
  const cookieHeader = request.headers.get('Cookie');
  const incoming =
    readCookie(cookieHeader, cookieName) === undefined
      ? undefined
      : await sessions.getSession(cookieHeader);
  const flash: RequestFlash = { read: incoming?.get(MESSAGE), taken: false, write: undefined };

  context.set(requestFlashContext, flash);

  const commit = async (response: Response): Promise<Response> => {
    if (flash.write !== undefined) {
      const session = incoming ?? (await sessions.getSession(null));
      session.flash(MESSAGE, flash.write);
      response.headers.append('Set-Cookie', await sessions.commitSession(session));
    } else if (incoming !== undefined && flash.taken) {
      // Destroyed rather than re-committed empty, so the browser stops sending a cookie
      // there is nothing left to read from.
      response.headers.append('Set-Cookie', await sessions.destroySession(incoming));
    }

    return response;
  };

  try {
    return await commit(await next());
  } catch (error) {
    if (error instanceof Response) throw await commit(error);
    throw error;
  }
};

/** Leave a message for the request that follows this one, usually across a redirect. */
export function setFlash(context: FlashContextReader, message: string): void {
  context.get(requestFlashContext).write = message;
}

/**
 * The message left by the previous request, if any. Taking it is what clears the cookie, so
 * it shows exactly once — on the page that asked for it.
 */
export function takeFlash(context: FlashContextReader): string | undefined {
  const flash = context.get(requestFlashContext);
  flash.taken = true;

  return flash.read;
}
