import '@fphd/ui/styles.scss';

import { AppDocument, AppShell, createDocumentMeta, RootErrorBoundary } from '@fphd/ui';
import { flashMiddleware } from '@fphd/web-server/flash';
import { getSession, sessionMiddleware } from '@fphd/web-server/session';
import { href, Outlet, useLoaderData } from 'react-router';

import type { Route } from './+types/root';

export const Layout = AppDocument;
export const meta = createDocumentMeta();
export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware, flashMiddleware];

export function loader({ context }: Route.LoaderArgs) {
  return { canManage: getSession(context)?.roles.includes('publisher') === true };
}

function navigationFor(canManage: boolean) {
  return [
    { href: href('/'), text: 'Home' },
    { href: href('/topics'), text: 'Topics' },
    ...(canManage ? [{ href: href('/manage'), text: 'Manage data' }] : []),
    { href: href('/sign-in'), text: 'Account' },
  ];
}

export default function InternalApp() {
  const { canManage } = useLoaderData<typeof loader>();

  return (
    <AppShell audience="Internal" navigation={navigationFor(canManage)}>
      <Outlet />
    </AppShell>
  );
}

export function ErrorBoundary() {
  // The root loader may not have run, or may be what failed, so there is no session to read
  // here — the error page omits the publisher-only link rather than guessing.
  return <RootErrorBoundary audience="Internal" navigation={navigationFor(false)} />;
}
