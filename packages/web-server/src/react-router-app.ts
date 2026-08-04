import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { createRequestHandler } from '@react-router/express';
import express, { type Express, type Request, type RequestHandler } from 'express';
import type { RouterContextProvider, ServerBuild } from 'react-router';

import { nonceContext } from './nonce-context.js';
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
  /**
   * Runs after the nonce is set, so it can add further values to the loader/action context.
   * It is given the request so a value can be request-scoped — the internal app builds its
   * API client here, carrying the caller's session on to the API.
   */
  extendContext?: (context: RouterContextProvider, request: Request) => void;
}

export function createReactRouterApp(
  loadBuild: ReactRouterBuildLoader,
  { backendMiddleware = [], session, extendContext }: ReactRouterAppOptions,
): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'private, no-store');
    next();
  });

  for (const middleware of backendMiddleware) app.use(middleware);

  app.use(
    createRequestHandler({
      build: async () => normalizeServerBuild(await loadBuild()),
      getLoadContext: (request, response) => {
        const context = createSessionContext(session);
        context.set(nonceContext, response.locals.nonce);
        extendContext?.(context, request);
        return context;
      },
    }),
  );

  return app;
}
