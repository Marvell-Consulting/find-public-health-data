import { type AppAudience, fakeUsersForAudience, normalizeReturnTo } from '@fphd/auth';
import { createDocumentMeta } from '@fphd/ui';
import { type LoaderFunctionArgs, type RouterContext, useLoaderData } from 'react-router';

import { SignInPage } from '../content-pages';

type SessionReader = (context: { get<T>(context: RouterContext<T>): T }) =>
  | {
      readonly roles: readonly string[];
      readonly sub: string;
    }
  | undefined;

export function createSignInRoute(audience: AppAudience, readSession: SessionReader) {
  const users = fakeUsersForAudience(audience);

  async function loader({ context, request }: LoaderFunctionArgs) {
    const session = readSession(context);
    const returnTo = normalizeReturnTo(new URL(request.url).searchParams.get('returnTo'));

    return {
      returnTo,
      session:
        session === undefined
          ? undefined
          : {
              roles: session.roles,
              subject: session.sub,
            },
    };
  }

  function SignInRoute() {
    const { returnTo, session } = useLoaderData<typeof loader>();

    return (
      <SignInPage
        audience={audience}
        returnTo={returnTo}
        users={users}
        {...(session === undefined ? {} : { session })}
      />
    );
  }

  return Object.freeze({
    Component: SignInRoute,
    loader,
    meta: createDocumentMeta('Sign in'),
  });
}
