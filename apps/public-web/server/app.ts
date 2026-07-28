import { apiContext } from '@fphd/public-web-features';
import { createFakeAuthReactRouterApp } from '@fphd/web-server/fake-auth-react-router';

import * as config from './config.ts';

export const app = createFakeAuthReactRouterApp(() => import('virtual:react-router/server-build'), {
  audience: 'public',
  session: config.session,
  extendContext: (context) => context.set(apiContext, { baseUrl: config.apiUrl }),
});
