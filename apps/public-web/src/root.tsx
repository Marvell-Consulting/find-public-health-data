import '@fphd/ui/styles.scss';

import { AppDocument, AppShell, createDocumentMeta } from '@fphd/ui';
import { sessionMiddleware } from '@fphd/web-server/session';
import { Outlet } from 'react-router';

import type { Route } from './+types/root';

const navigation = [
  { href: '/', text: 'Home' },
  { href: '/releases', text: 'Releases' },
  { href: '/sign-in', text: 'Sign in' },
];

export const Layout = AppDocument;
export const meta = createDocumentMeta();
export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware];

export default function PublicApp() {
  return (
    <AppShell audience="Public" highlightCurrentNavigation={false} navigation={navigation}>
      <Outlet />
    </AppShell>
  );
}
