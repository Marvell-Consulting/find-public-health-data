import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { createRequestHandler } from '@react-router/express';
import express, { type Express, type RequestHandler } from 'express';
import type { ServerBuild } from 'react-router';

import { createSessionContext } from './session.js';

type OptionalServerBuildKey = 'allowedActionOrigins' | 'basename' | 'unstable_getCriticalCss';

type GeneratedServerBuild = Omit<ServerBuild, OptionalServerBuildKey> & {
  allowedActionOrigins: ServerBuild['allowedActionOrigins'] | undefined;
  basename: ServerBuild['basename'] | undefined;
  unstable_getCriticalCss: ServerBuild['unstable_getCriticalCss'] | undefined;
};

export type ReactRouterBuildLoader = () => Promise<GeneratedServerBuild>;

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
  backendMiddleware?: readonly RequestHandler[];
  session: JwtSessionVerifier;
}

export function createReactRouterApp(
  loadBuild: ReactRouterBuildLoader,
  { backendMiddleware = [], session }: ReactRouterAppOptions,
): Express {
  const app = express();

  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'private, no-store');
    next();
  });

  for (const middleware of backendMiddleware) app.use(middleware);

  app.use(
    createRequestHandler({
      build: async () => normalizeServerBuild(await loadBuild()),
      getLoadContext: () => createSessionContext(session),
    }),
  );

  return app;
}
