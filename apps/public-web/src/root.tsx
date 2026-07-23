import '@fphd/ui/styles.scss';

import { AppDocument, AppShell, createDocumentMeta } from '@fphd/ui';
import { getSession, sessionMiddleware } from '@fphd/web-server/session';
import { Outlet, useLoaderData } from 'react-router';

import type { Route } from './+types/root';

export const Layout = AppDocument;
export const meta = createDocumentMeta();
export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware];

export function loader({ context }: Route.LoaderArgs) {
  return { signedIn: getSession(context) !== undefined };
}

export default function PublicApp() {
  const { signedIn } = useLoaderData<typeof loader>();
  const navigation = [
    { href: '/', text: 'Home' },
    { href: '/releases', text: 'Releases' },
    { href: '/sign-in', text: signedIn ? 'Account' : 'Sign in' },
  ];

  return (
    <AppShell audience="Public" highlightCurrentNavigation={false} navigation={navigation}>
      <Outlet />
    </AppShell>
  );
}
