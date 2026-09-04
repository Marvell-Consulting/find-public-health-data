import { createRequireSessionRoleMiddleware } from '@fphd/web-server/session';
import { href, Outlet } from 'react-router';

import type { Route } from './+types/publisher';

// The publisher role check, declared once for every route under this layout.
export const middleware: Route.MiddlewareFunction[] = [
  createRequireSessionRoleMiddleware({
    forbiddenPath: href('/access-denied'),
    role: 'publisher',
    signInPath: href('/sign-in'),
  }),
];

export default function PublisherRoutes() {
  return <Outlet />;
}
