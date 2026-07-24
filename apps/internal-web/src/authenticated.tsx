import { createRequireSessionRoleMiddleware } from '@fphd/web-server/session';
import { href, Outlet } from 'react-router';

import type { Route } from './+types/authenticated';

export const middleware: Route.MiddlewareFunction[] = [
  createRequireSessionRoleMiddleware({
    forbiddenPath: href('/access-denied'),
    role: 'internal',
    signInPath: href('/sign-in'),
  }),
];

export default function AuthenticatedInternalRoutes() {
  return <Outlet />;
}
