import { internalFeatureRoutes } from '@fphd/internal-web-features';
import { publicFeatureRoutes } from '@fphd/public-web-features';
import { createBrowserRouter, type RouteObject } from 'react-router';

import { InternalApp, NotFoundPage } from './app';

export const internalRoutes = [
  {
    path: '/',
    Component: InternalApp,
    children: [
      ...publicFeatureRoutes,
      ...internalFeatureRoutes,
      { path: '*', Component: NotFoundPage },
    ],
  },
] satisfies RouteObject[];

export const internalRouter = createBrowserRouter(internalRoutes);
