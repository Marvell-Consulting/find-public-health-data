import { createFakeAuthReactRouterApp } from '@fphd/web-server/fake-auth-react-router';

import { session as sessionConfig } from './config.ts';

export const app = createFakeAuthReactRouterApp(() => import('virtual:react-router/server-build'), {
  audience: 'internal',
  session: sessionConfig,
});
