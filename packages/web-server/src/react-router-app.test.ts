import { createJwtSessionService } from '@fphd/auth/jwt-session';
import { describe, expect, it } from 'vitest';

import { createReactRouterApp } from './react-router-app.js';

const session = createJwtSessionService({
  audience: 'fphd-public',
  cookieName: 'fphd-public-session',
  issuer: 'fphd-auth',
  secret: 'a-jwt-session-secret-that-is-long-enough-for-tests',
  secure: false,
});

describe('createReactRouterApp', () => {
  it('does not advertise Express via x-powered-by on document responses', () => {
    const app = createReactRouterApp(
      () => {
        throw new Error('build should not load while asserting app settings');
      },
      { session },
    );

    expect(app.disabled('x-powered-by')).toBe(true);
  });
});
