import '@fphd/ui/styles.scss';

import { AppDocument, AppShell, createDocumentMeta, RootErrorBoundary } from '@fphd/ui';
import { sessionMiddleware } from '@fphd/web-server/session';
import { href, Outlet } from 'react-router';

import type { Route } from './+types/root';

export const Layout = AppDocument;
export const meta = createDocumentMeta();
export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware];

const navigation = [
  { href: href('/'), text: 'Home' },
  { href: href('/search'), text: 'Search' },
  { href: href('/topics'), text: 'Topics' },
];

export default function PublicApp() {
  return (
    <AppShell audience="Public" navigation={navigation}>
      <Outlet />
    </AppShell>
  );
}

export function ErrorBoundary() {
  return <RootErrorBoundary audience="Public" navigation={navigation} />;
}
