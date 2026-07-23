import { randomUUID } from 'node:crypto';

import {
  type AppAudience,
  type FakeUser,
  normalizeReturnTo,
  sessionRolesForAudience,
} from '@fphd/auth';
import type { JwtSessionService } from '@fphd/auth/jwt-session';
import express, { type Router } from 'express';

interface PendingSignIn {
  readonly expiresAt: number;
  readonly returnTo: string;
  readonly user: FakeUser;
}

export interface FakeAuthRouterOptions {
  audience: AppAudience;
  clock?: () => Date;
  codeLifetimeSeconds?: number;
  defaultReturnTo?: string;
  session: JwtSessionService;
  sessionLifetimeSeconds?: number;
  users: readonly FakeUser[];
}

function readStringField(body: unknown, name: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;

  const value = Reflect.get(body, name);
  return typeof value === 'string' ? value : undefined;
}

function readQueryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function createFakeAuthRouter({
  audience,
  clock = () => new Date(),
  codeLifetimeSeconds = 300,
  defaultReturnTo = '/',
  session,
  sessionLifetimeSeconds = 8 * 60 * 60,
  users,
}: FakeAuthRouterOptions): Router {
  const pendingSignIns = new Map<string, PendingSignIn>();
  const router = express.Router();

  router.use(express.urlencoded({ extended: false }));

  router.post('/auth/sign-in', (request, response) => {
    const userId = readStringField(request.body, 'userId');
    const user = users.find((candidate) => candidate.id === userId);

    if (user === undefined) {
      response.status(403).send('This user cannot access this service.');
      return;
    }

    const now = clock().getTime();
    for (const [code, signIn] of pendingSignIns) {
      if (signIn.expiresAt <= now) pendingSignIns.delete(code);
    }

    const code = randomUUID();
    pendingSignIns.set(code, {
      expiresAt: now + codeLifetimeSeconds * 1_000,
      returnTo: normalizeReturnTo(readStringField(request.body, 'returnTo'), defaultReturnTo),
      user,
    });

    response.redirect(303, `/auth/callback?code=${encodeURIComponent(code)}`);
  });

  router.get('/auth/callback', async (request, response) => {
    const code = readQueryValue(request.query.code);
    const signIn = code === undefined ? undefined : pendingSignIns.get(code);

    if (code === undefined || signIn === undefined || signIn.expiresAt <= clock().getTime()) {
      if (code !== undefined) pendingSignIns.delete(code);
      response.status(400).send('The sign-in request is invalid or has expired.');
      return;
    }

    pendingSignIns.delete(code);
    const token = await session.issueToken({
      expiresInSeconds: sessionLifetimeSeconds,
      roles: sessionRolesForAudience(signIn.user, audience),
      subject: signIn.user.id,
    });

    response.setHeader('Set-Cookie', session.createCookieHeader(token, sessionLifetimeSeconds));
    response.redirect(303, signIn.returnTo);
  });

  router.post('/auth/sign-out', (request, response) => {
    response.setHeader('Set-Cookie', session.clearCookieHeader());
    response.redirect(
      303,
      normalizeReturnTo(readStringField(request.body, 'returnTo'), '/sign-in'),
    );
  });

  return router;
}
