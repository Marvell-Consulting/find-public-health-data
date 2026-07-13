import { createRequestHandler } from '@react-router/express';
import express, { type Express } from 'express';
import type { ServerBuild } from 'react-router';

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

export function createReactRouterApp(loadBuild: () => Promise<GeneratedServerBuild>): Express {
  const app = express();

  app.use(
    createRequestHandler({
      build: async () => normalizeServerBuild(await loadBuild()),
    }),
  );

  return app;
}
