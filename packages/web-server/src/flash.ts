import type { AppAudience } from '@fphd/auth';
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
 * call site changing.
 */
export function createFlashSessionStorage({ audience, secret, secure }: FlashSessionOptions) {
  return createCookieSessionStorage<Record<string, string>, Record<string, string>>({
    cookie: {
      name: `fphd-${audience}-flash`,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secrets: [secret],
      secure,
    },
  });
}

/**
 * A request-scoped mailbox. `read` is what arrived on the cookie; `write` is what the action
 * left for the next request, which only the middleware can turn into a `Set-Cookie` — no
 * route hand-rolls that header.
 */
interface RequestFlash {
  read: string | undefined;
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
 * Reads the incoming message on the way in and commits the outgoing one on the way out.
 *
 * The commit is not optional when a message arrived: a flash is cleared as it is read, so a
 * response that does not re-commit leaves the old cookie in place and shows the message again
 * on the next page.
 */
export const flashMiddleware: MiddlewareFunction<Response> = async ({ context, request }, next) => {
  const storage = context.get(flashStorageContext);
  const session = await storage.getSession(request.headers.get('Cookie'));
  const flash: RequestFlash = { read: session.get(MESSAGE), write: undefined };

  context.set(requestFlashContext, flash);

  const commit = async (response: Response): Promise<Response> => {
    if (flash.write !== undefined) session.flash(MESSAGE, flash.write);

    if (flash.read !== undefined || flash.write !== undefined) {
      response.headers.append('Set-Cookie', await storage.commitSession(session));
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

/** The message left by the previous request, if any. It is gone from the next one. */
export function takeFlash(context: FlashContextReader): string | undefined {
  return context.get(requestFlashContext).read;
}
