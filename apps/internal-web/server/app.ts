import { createReactRouterApp } from '@fphd/web-server/react-router';

export const app = createReactRouterApp(() => import('virtual:react-router/server-build'));
