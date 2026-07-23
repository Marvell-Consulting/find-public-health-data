import { type AppAudience, fakeUsersForAudience } from '@fphd/auth';
import {
  createJwtSessionService,
  createJwtSessionVerifier,
  type JwtSessionServiceOptions,
} from '@fphd/auth/jwt-session';

import { createFakeAuthRouter } from './fake-auth.js';
import { createReactRouterApp, type ReactRouterBuildLoader } from './react-router-app.js';

interface FakeAuthReactRouterAppOptions {
  audience: AppAudience;
  session: Pick<JwtSessionServiceOptions, 'secret' | 'secure'>;
}

export function createFakeAuthReactRouterApp(
  loadBuild: ReactRouterBuildLoader,
  { audience, session }: FakeAuthReactRouterAppOptions,
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
  });
}
