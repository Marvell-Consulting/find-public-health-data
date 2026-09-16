import { createRequireSessionRoleMiddleware } from '@fphd/web-server/session';
import { href, Outlet } from 'react-router';

import type { Route } from './+types/admin';

export const middleware: Route.MiddlewareFunction[] = [
  createRequireSessionRoleMiddleware({
    forbiddenPath: href('/access-denied'),
    role: 'admin',
    signInPath: href('/'),
  }),
];

export default function AdminRoutes() {
  return <Outlet />;
}
