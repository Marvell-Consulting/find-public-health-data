import { sessionCookieName } from '@fphd/auth';
import { createApiClient, forwardedCookieHeaders } from '@fphd/web-server/api-client';
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
    // Per request: the client carries the caller's session cookie, and only that, to the API.
    context.set(
      apiContext,
      createApiClient({
        baseUrl: config.apiUrl,
        headers: forwardedCookieHeaders(request.headers.cookie, sessionCookieName(audience)),
      }),
    );
    setFlashStorage(context, flashStorage);
  },
});
