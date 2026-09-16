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
  const session = getSession(context);

  return {
    canManage: session?.roles.includes('admin') === true,
    signedIn: session !== undefined,
  };
}

function navigationFor({ canManage, signedIn }: { canManage: boolean; signedIn: boolean }) {
  return [
    ...(canManage ? [{ href: href('/manage'), text: 'Manage' }] : []),
    { href: href('/sign-in'), text: signedIn ? 'Account' : 'Sign in' },
  ];
}

export default function InternalApp() {
  const { canManage, signedIn } = useLoaderData<typeof loader>();

  return (
    <AppShell
      audience="Internal"
      navigation={navigationFor({ canManage, signedIn })}
      serviceHref={href('/dashboard')}
    >
      <Outlet />
    </AppShell>
  );
}

export function ErrorBoundary() {
  // The root loader may not have run, or may be what failed, so there is no session to read
  // here — the error page shows the signed-out navigation rather than guessing.
  return (
    <RootErrorBoundary
      audience="Internal"
      navigation={navigationFor({ canManage: false, signedIn: false })}
      serviceHref={href('/dashboard')}
    />
  );
}
