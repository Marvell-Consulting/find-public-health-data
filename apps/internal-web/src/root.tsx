import '@fphd/ui/styles.scss';

import { AppDocument, AppShell, createDocumentMeta } from '@fphd/ui';
import { getSession, sessionMiddleware } from '@fphd/web-server/session';
import { Outlet, useLoaderData } from 'react-router';

import type { Route } from './+types/root';

export const Layout = AppDocument;
export const meta = createDocumentMeta();
export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware];

export function loader({ context }: Route.LoaderArgs) {
  return { canManage: getSession(context)?.roles.includes('publisher') === true };
}

export default function InternalApp() {
  const { canManage } = useLoaderData<typeof loader>();
  const navigation = [
    { href: '/', text: 'Home' },
    { href: '/releases', text: 'Releases' },
    ...(canManage ? [{ href: '/manage', text: 'Manage data' }] : []),
    { href: '/sign-in', text: 'Account' },
  ];

  return (
    <AppShell audience="Internal" navigation={navigation}>
      <Outlet />
    </AppShell>
  );
}
