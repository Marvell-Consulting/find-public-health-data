import { createJwtSessionService } from '@fphd/auth/jwt-session';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createFakeAuthReactRouterApp } from './fake-auth-react-router-app.js';

const secret = 'a-jwt-session-secret-that-is-long-enough-for-tests';

function requireHeader(value: string | undefined, name: string): string {
  if (value === undefined) throw new Error(`Missing ${name} header`);
  return value;
}

describe('fake-auth React Router application', () => {
  it('issues audience-scoped sessions and prevents personalized responses being cached', async () => {
    const app = createFakeAuthReactRouterApp(
      async () => {
        throw new Error('React Router handler should not run for authentication routes');
      },
      {
        audience: 'public',
        session: { secret, secure: false },
      },
    );
    const session = createJwtSessionService({
      audience: 'fphd-public',
      cookieName: 'fphd-public-session',
      issuer: 'fphd-auth',
      secret,
      secure: false,
    });
    const signIn = await request(app).post('/auth/sign-in').type('form').send({
      userId: 'internal-publisher',
    });
    const callback = await request(app).get(requireHeader(signIn.get('Location'), 'Location'));
    const cookie = requireHeader(callback.get('Set-Cookie')?.[0], 'Set-Cookie');
    const token = session.readToken(cookie);

    if (token === undefined) throw new Error('Session cookie did not contain a token');

    await expect(session.verifyToken(token)).resolves.toMatchObject({
      roles: ['public'],
      sub: 'internal-publisher',
    });
    expect(signIn.headers['cache-control']).toBe('private, no-store');
    expect(callback.headers['cache-control']).toBe('private, no-store');
  });
});
