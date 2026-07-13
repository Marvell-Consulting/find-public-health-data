import { createRequestHandler } from '@react-router/express';
import express from 'express';
import type { ServerBuild } from 'react-router';

export const app = express();

app.use(
  createRequestHandler({
    build: async () =>
      (await import('virtual:react-router/server-build')) as unknown as ServerBuild,
  }),
);
