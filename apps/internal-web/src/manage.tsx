import { ManageDataPage } from '@fphd/internal-web-features';
import { createDocumentMeta } from '@fphd/ui';
import { createRequireSessionRoleMiddleware } from '@fphd/web-server/session';
import { href } from 'react-router';

import type { Route } from './+types/manage';

export const meta = createDocumentMeta('Manage public health data');
export const middleware: Route.MiddlewareFunction[] = [
  createRequireSessionRoleMiddleware({
    forbiddenPath: href('/access-denied'),
    role: 'publisher',
    signInPath: href('/sign-in'),
  }),
];

export default ManageDataPage;
