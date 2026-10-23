import { canListIndicators } from '@fphd/auth/permissions';
import { createRequireSessionMiddleware } from '@fphd/web-server/session';
import { href, Outlet } from 'react-router';

import type { Route } from './+types/dashboard';

export const middleware: Route.MiddlewareFunction[] = [
  createRequireSessionMiddleware({
    allows: canListIndicators,
    forbiddenPath: href('/access-denied'),
    signInPath: href('/'),
  }),
];

export default function DashboardRoutes() {
  return <Outlet />;
}
