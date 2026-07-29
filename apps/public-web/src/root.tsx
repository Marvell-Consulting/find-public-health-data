import '@fphd/ui/styles.scss';

import { AppDocument, AppShell, createDocumentMeta, RootErrorBoundary } from '@fphd/ui';
import { getSession, sessionMiddleware } from '@fphd/web-server/session';
import { href, Outlet, useLoaderData } from 'react-router';

import type { Route } from './+types/root';

export const Layout = AppDocument;
export const meta = createDocumentMeta();
export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware];

export function loader({ context }: Route.LoaderArgs) {
  return { signedIn: getSession(context) !== undefined };
}

function navigationFor(signedIn: boolean) {
  return [
    { href: href('/'), text: 'Home' },
    { href: href('/releases'), text: 'Releases' },
    { href: href('/sign-in'), text: signedIn ? 'Account' : 'Sign in' },
  ];
}

export default function PublicApp() {
  const { signedIn } = useLoaderData<typeof loader>();

  return (
    <AppShell
      audience="Public"
      highlightCurrentNavigation={false}
      navigation={navigationFor(signedIn)}
    >
      <Outlet />
    </AppShell>
  );
}

export function ErrorBoundary() {
  // The root loader may not have run, or may be what failed, so there is no session to read
  // here — the error page shows the signed-out navigation rather than guessing.
  return <RootErrorBoundary audience="Public" navigation={navigationFor(false)} />;
}
