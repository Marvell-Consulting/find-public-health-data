import { PassThrough } from 'node:stream';
import { NonceProvider } from '@fphd/ui/nonce';
import { createReadableStreamFromReadable } from '@react-router/node';
import { isbot } from 'isbot';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';
import {
  type EntryContext,
  type HandleErrorFunction,
  isRouteErrorResponse,
  type RouterContextProvider,
  ServerRouter,
} from 'react-router';

import { loggerContext } from './logger-context.js';
import { nonceContext } from './nonce-context.js';

export const streamTimeout = 5_000;

function requestFields(request: Request) {
  const { pathname, search } = new URL(request.url);
  return { method: request.method, url: `${pathname}${search}` };
}

/** Loader, action and render failures. Thrown responses never arrive here, so a not-found page
 * is not an error. */
export const handleError: HandleErrorFunction = (error, { context, request }) => {
  if (request.signal.aborted) return;

  const err =
    isRouteErrorResponse(error) && 'error' in error && error.error !== undefined
      ? error.error
      : error;
  context.get(loggerContext).error({ err, req: requestFields(request) }, 'Request failed');
};

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  entryContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  const nonce = loadContext.get(nonceContext);
  const logger = loadContext.get(loggerContext);
  return new Promise<Response>((resolve, reject) => {
    let abortTimeout: ReturnType<typeof setTimeout> | undefined;
    let shellRendered = false;
    const clearAbortTimeout = () => {
      if (abortTimeout !== undefined) {
        clearTimeout(abortTimeout);
        abortTimeout = undefined;
      }
    };
    const userAgent = request.headers.get('user-agent');
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || entryContext.isSpaMode ? 'onAllReady' : 'onShellReady';

    const { abort, pipe } = renderToPipeableStream(
      <NonceProvider value={nonce}>
        <ServerRouter context={entryContext} nonce={nonce} url={request.url} />
      </NonceProvider>,
      {
        // React's own boundary-completion scripts are injected inline as the stream
        // resolves; without this they carry no nonce and the CSP blocks them.
        nonce,
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          body.once('close', clearAbortTimeout);
          body.once('finish', clearAbortTimeout);

          responseHeaders.set('Content-Type', 'text/html');
          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }));
          pipe(body);
        },
        onShellError(error: unknown) {
          clearAbortTimeout();
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Before the shell is out, onShellError rejects and React Router reports it instead.
          if (shellRendered) {
            logger.error({ err: error, req: requestFields(request) }, 'Streaming failed');
          }
        },
      },
    );

    abortTimeout = setTimeout(abort, streamTimeout + 1_000);
  });
}
