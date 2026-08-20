import { type AppAudience, fakeUsersForAudience, sessionCookieName } from '@fphd/auth';
import {
  createJwtSessionService,
  createJwtSessionVerifier,
  type JwtSessionServiceOptions,
} from '@fphd/auth/jwt-session';

import type { Request } from 'express';
import type { RouterContextProvider } from 'react-router';

import { createFakeAuthRouter } from './fake-auth.js';
import { createReactRouterApp, type ReactRouterBuildLoader } from './react-router-app.js';

interface FakeAuthReactRouterAppOptions {
  audience: AppAudience;
  session: Pick<JwtSessionServiceOptions, 'secret' | 'secure'>;
  extendContext?: (context: RouterContextProvider, request: Request) => void;
}

export function createFakeAuthReactRouterApp(
  loadBuild: ReactRouterBuildLoader,
  { audience, session, extendContext }: FakeAuthReactRouterAppOptions,
) {
  const sessionService = createJwtSessionService({
    audience: `fphd-${audience}`,
    cookieName: sessionCookieName(audience),
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
