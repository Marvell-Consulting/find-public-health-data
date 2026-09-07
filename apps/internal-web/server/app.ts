import { sessionCookieName } from '@fphd/auth';
import {
  createApiClient,
  forwardedCookieHeaders,
  forwardedRequestIdHeaders,
} from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { createFakeAuthReactRouterApp } from '@fphd/web-server/fake-auth-react-router';
import { createFlashSessionStorage, setFlashStorage } from '@fphd/web-server/flash';

import * as config from './config.ts';

const audience = 'internal';
const flashStorage = createFlashSessionStorage({ audience, ...config.webSession });

export const app = createFakeAuthReactRouterApp(() => import('virtual:react-router/server-build'), {
  audience,
  session: config.session,
  trustedProxyHops: config.trustedProxyHops,
  extendContext: (context, request) => {
    // Per request: the client carries the caller's session cookie, and only that, to the API,
    // plus the request id so the two logs read as one flow.
    context.set(
      apiContext,
      createApiClient({
        baseUrl: config.apiUrl,
        headers: {
          ...forwardedCookieHeaders(request.headers.cookie, sessionCookieName(audience)),
          ...forwardedRequestIdHeaders(request),
        },
      }),
    );
    setFlashStorage(context, flashStorage);
  },
});
