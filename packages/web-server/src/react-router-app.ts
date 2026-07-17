import { createRequestHandler } from '@react-router/express';
import express, { type Express } from 'express';
import { createCookieSessionStorage, type ServerBuild, type SessionStorage } from 'react-router';

import { createSessionContext } from './session.js';

type OptionalServerBuildKey = 'allowedActionOrigins' | 'basename' | 'unstable_getCriticalCss';

type GeneratedServerBuild = Omit<ServerBuild, OptionalServerBuildKey> & {
  allowedActionOrigins: ServerBuild['allowedActionOrigins'] | undefined;
  basename: ServerBuild['basename'] | undefined;
  unstable_getCriticalCss: ServerBuild['unstable_getCriticalCss'] | undefined;
};

/**
 * React Router's generated module emits optional build fields as required
 * properties whose values can be undefined. Convert that generated shape into
 * the public ServerBuild shape by omitting absent optional fields.
 */
function normalizeServerBuild({
  allowedActionOrigins,
  basename,
  unstable_getCriticalCss,
  ...build
}: GeneratedServerBuild): ServerBuild {
  return {
    ...build,
    ...(allowedActionOrigins === undefined ? {} : { allowedActionOrigins }),
    ...(basename === undefined ? {} : { basename }),
    ...(unstable_getCriticalCss === undefined ? {} : { unstable_getCriticalCss }),
  };
}

interface ReactRouterAppOptions {
  sessionStorage: SessionStorage;
}

interface WebSessionStorageOptions {
  cookieName: string;
  secret: string | undefined;
  secure: boolean;
}

/**
 * Creates signed, browser-backed session storage. Values are authenticated but
 * not encrypted, so credentials and provider tokens must not be stored here.
 */
export function createWebSessionStorage({
  cookieName,
  secret,
  secure,
}: WebSessionStorageOptions): SessionStorage {
  if (secret === undefined || secret.trim() === '') {
    throw new Error('SESSION_SECRET is required');
  }

  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error('SESSION_SECRET must be at least 32 bytes');
  }

  return createCookieSessionStorage({
    cookie: {
      httpOnly: true,
      name: cookieName,
      path: '/',
      sameSite: 'lax',
      secrets: [secret],
      secure,
    },
  });
}

export function createReactRouterApp(
  loadBuild: () => Promise<GeneratedServerBuild>,
  { sessionStorage }: ReactRouterAppOptions,
): Express {
  const app = express();

  app.use(
    createRequestHandler({
      build: async () => normalizeServerBuild(await loadBuild()),
      getLoadContext: () => createSessionContext(sessionStorage),
    }),
  );

  return app;
}
