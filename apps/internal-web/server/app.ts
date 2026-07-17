import { createReactRouterApp, createWebSessionStorage } from '@fphd/web-server/react-router';

const sessionStorage = createWebSessionStorage({
  cookieName: 'fphd-internal-session',
  secret: process.env.SESSION_SECRET,
  secure: process.env.NODE_ENV === 'production',
});

export const app = createReactRouterApp(() => import('virtual:react-router/server-build'), {
  sessionStorage,
});
