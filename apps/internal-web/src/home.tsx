import { normalizeReturnTo } from '@fphd/auth';
import { SignInLandingPage } from '@fphd/internal-web-features';
import { createDocumentMeta } from '@fphd/ui';
import { getSession } from '@fphd/web-server/session';
import { href, redirect, useLoaderData } from 'react-router';

import type { Route } from './+types/home';

// Every route that needs a session sends a signed-out visitor here, with the page they wanted
// carried through to the sign-in itself.
export function loader({ context, request }: Route.LoaderArgs) {
  if (getSession(context) !== undefined) return redirect(href('/dashboard'));

  const returnTo = normalizeReturnTo(new URL(request.url).searchParams.get('returnTo'));
  const query = returnTo === '/' ? '' : `?${new URLSearchParams({ returnTo })}`;

  return { signInHref: `${href('/sign-in')}${query}` };
}

export const meta = createDocumentMeta('Sign in to manage indicators');

export default function HomeRoute() {
  const { signInHref } = useLoaderData<typeof loader>();

  return <SignInLandingPage signInHref={signInHref} />;
}
