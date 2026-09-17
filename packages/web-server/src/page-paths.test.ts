import type { ServerBuild } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createPagePathCheck } from './page-paths.js';

// The shape of an app's route table, as the server build carries it: only the fields the check
// reads. A resource route is one whose module has no component.
const routes = {
  root: { id: 'root', path: '', module: { default: () => null } },
  home: { id: 'home', parentId: 'root', index: true, module: { default: () => null } },
  signIn: { id: 'signIn', parentId: 'root', path: 'sign-in', module: { default: () => null } },
  authenticated: { id: 'authenticated', parentId: 'root', module: { default: () => null } },
  dashboard: {
    id: 'dashboard',
    parentId: 'authenticated',
    path: 'dashboard',
    module: { default: () => null },
  },
  tableCsv: {
    id: 'tableCsv',
    parentId: 'authenticated',
    path: 'indicators/:alias/table.csv',
    module: { loader: () => null },
  },
  notFound: { id: 'notFound', parentId: 'root', path: '*', module: { default: () => null } },
} as unknown as ServerBuild['routes'];

const isPagePath = createPagePathCheck({ routes });

describe('createPagePathCheck', () => {
  it.each(['/', '/sign-in', '/dashboard', '/dashboard?page=2', '/dashboard#top'])(
    'accepts the page %s',
    (path) => {
      expect(isPagePath(path)).toBe(true);
    },
  );

  it.each([
    '/dashboard.data',
    '/_.data',
    '/auth/sign-out',
    '/indicators/90366/table.csv',
    '/no-such-page',
  ])('rejects %s, which is not a page', (path) => {
    expect(isPagePath(path)).toBe(false);
  });
});
