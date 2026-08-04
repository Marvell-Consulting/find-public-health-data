import { createRequireSessionRoleMiddleware } from '@fphd/web-server/session';
import { href, Outlet } from 'react-router';

import type { Route } from './+types/publisher';

// Declared once for every publisher route rather than on each of them: three routes each
// repeating the same middleware is where that starts to drift.
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
