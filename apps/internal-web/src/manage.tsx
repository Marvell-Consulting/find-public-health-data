import { ManageDataPage } from '@fphd/internal-web-features';
import { createDocumentMeta } from '@fphd/ui';
import { createRequireSessionRoleMiddleware } from '@fphd/web-server/session';

import type { Route } from './+types/manage';

export const meta = createDocumentMeta('Manage public health data');
export const middleware: Route.MiddlewareFunction[] = [
  createRequireSessionRoleMiddleware({ forbiddenPath: '/access-denied', role: 'publisher' }),
];

export default ManageDataPage;
