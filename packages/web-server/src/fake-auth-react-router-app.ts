import { type AppAudience, fakeUsersForAudience } from '@fphd/auth';
import {
  createJwtSessionService,
  createJwtSessionVerifier,
  type JwtSessionServiceOptions,
} from '@fphd/auth/jwt-session';

import type { RouterContextProvider } from 'react-router';

import { createFakeAuthRouter } from './fake-auth.js';
import { createReactRouterApp, type ReactRouterBuildLoader } from './react-router-app.js';

interface FakeAuthReactRouterAppOptions {
  audience: AppAudience;
  session: Pick<JwtSessionServiceOptions, 'secret' | 'secure'>;
  extendContext?: (context: RouterContextProvider) => void;
}

export function createFakeAuthReactRouterApp(
  loadBuild: ReactRouterBuildLoader,
  { audience, session, extendContext }: FakeAuthReactRouterAppOptions,
) {
  const sessionService = createJwtSessionService({
    audience: `fphd-${audience}`,
    cookieName: `fphd-${audience}-session`,
    issuer: 'fphd-auth',
    ...session,
  });

  return createReactRouterApp(loadBuild, {
    backendMiddleware: [
      createFakeAuthRouter({
        audience,
        session: sessionService,
        users: fakeUsersForAudience(audience),
      }),
    ],
    session: createJwtSessionVerifier(sessionService),
    // Spread rather than passed directly: exactOptionalPropertyTypes rejects an explicit undefined.
    ...(extendContext === undefined ? {} : { extendContext }),
  });
}
