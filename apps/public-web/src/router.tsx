import { publicFeatureRoutes } from '@fphd/public-web-features';
import { createBrowserRouter, type RouteObject } from 'react-router';

import { NotFoundPage, PublicApp } from './app';

export const publicRoutes = [
  {
    path: '/',
    Component: PublicApp,
    children: [...publicFeatureRoutes, { path: '*', Component: NotFoundPage }],
  },
] satisfies RouteObject[];

export const publicRouter = createBrowserRouter(publicRoutes);
