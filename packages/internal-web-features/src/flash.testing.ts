import {
  createFlashSessionStorage,
  flashMiddleware,
  setFlash,
  setFlashStorage,
  takeFlash,
} from '@fphd/web-server/flash';
import { RouterContextProvider } from 'react-router';

const flashStorage = createFlashSessionStorage({
  audience: 'internal',
  secret: 'a-web-session-secret-that-is-long-enough-for-tests',
  secure: false,
});

/** Gives a loader's context the flash storage the app's middleware reads. */
export function withFlashStorage<Context extends RouterContextProvider>(context: Context): Context {
  setFlashStorage(context, flashStorage);
  return context;
}

/** The cookie the browser would send back after a response set one. */
function cookieFrom(response: Response): string {
  return response.headers.getSetCookie().at(-1)?.split(';', 1)[0] ?? '';
}

/**
 * Runs a loader or action inside the flash middleware, as the app does, and answers the
 * response it returned or threw, carrying any flash it left. Anything else it answers is
 * rendered as a page, so the response is a 200 with no `Location`.
 */
export async function flashedResponse(
  context: RouterContextProvider,
  request: Request,
  handler: () => Promise<unknown>,
): Promise<Response> {
  const args = { context, params: {}, pattern: '/', request, url: new URL(request.url) };

  try {
    const response = await flashMiddleware(args as never, async () => {
      const outcome = await handler();
      return outcome instanceof Response ? outcome : new Response('rendered');
    });
    if (!(response instanceof Response)) throw new Error('The middleware returned no response');
    return response;
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

/** The flash a response left, as the next request would take it. */
export async function flashLeftBy(response: Response): Promise<string | undefined> {
  const context = withFlashStorage(new RouterContextProvider());
  const request = new Request('https://internal.test/', {
    headers: { Cookie: cookieFrom(response) },
  });
  let flash: string | undefined;

  await flashedResponse(context, request, async () => {
    flash = takeFlash(context);
  });

  return flash;
}

/** Where a response sends the browser, and the flash it leaves for the page there. */
export async function redirectWithFlash(response: Response) {
  return {
    status: response.status,
    location: response.headers.get('Location'),
    flash: await flashLeftBy(response),
  };
}

/** Runs a loader inside the flash middleware, as the app does, and answers what it returned. */
export async function loadWithFlash<T>(
  context: RouterContextProvider,
  request: Request,
  loader: () => Promise<T>,
): Promise<T> {
  let outcome: T | undefined;
  let loaded = false;

  await flashedResponse(context, request, async () => {
    outcome = await loader();
    loaded = true;
  });

  if (!loaded) throw new Error('The loader answered with a response');
  return outcome as T;
}

/** The cookie a browser sends after a page left `flash` for the next. */
export async function flashCookie(flash: string): Promise<string> {
  const context = withFlashStorage(new RouterContextProvider());
  const response = await flashedResponse(context, new Request('https://internal.test/'), async () =>
    setFlash(context, flash),
  );
  return cookieFrom(response);
}
