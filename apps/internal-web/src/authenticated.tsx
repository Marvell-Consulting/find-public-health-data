import { createRequireSessionRoleMiddleware } from '@fphd/web-server/session';
import { Outlet } from 'react-router';

import type { Route } from './+types/authenticated';

export const middleware: Route.MiddlewareFunction[] = [
  createRequireSessionRoleMiddleware({ forbiddenPath: '/access-denied', role: 'internal' }),
];

export default function AuthenticatedInternalRoutes() {
  return <Outlet />;
}
