import { describe, expect, it } from 'vitest';

import { collectRouteFiles } from './routes.js';

const routeTable = JSON.stringify([
  {
    id: 'root',
    path: '',
    file: 'root.tsx',
    children: [
      {
        id: 'home',
        index: true,
        file: '../../../packages/public-web-features/src/routes/home.tsx',
      },
      {
        id: 'manage',
        path: 'manage',
        file: '../../../packages/internal-web-features/src/manage-route.tsx',
      },
      { id: 'catch-all', path: '*', file: '../../../packages/ui/src/not-found-route.tsx' },
    ],
  },
]);

describe('collectRouteFiles', () => {
  it('collects every route module path, nested routes included', () => {
    expect(collectRouteFiles(routeTable)).toEqual([
      'root.tsx',
      '../../../packages/public-web-features/src/routes/home.tsx',
      '../../../packages/internal-web-features/src/manage-route.tsx',
      '../../../packages/ui/src/not-found-route.tsx',
    ]);
  });

  it('recurses to any depth', () => {
    const nested = JSON.stringify([
      { file: 'a.tsx', children: [{ file: 'b.tsx', children: [{ file: 'c.tsx' }] }] },
    ]);

    expect(collectRouteFiles(nested)).toEqual(['a.tsx', 'b.tsx', 'c.tsx']);
  });

  it('ignores routes that declare no file', () => {
    expect(collectRouteFiles(JSON.stringify([{ path: 'layout-only' }, { file: 'a.tsx' }]))).toEqual(
      ['a.tsx'],
    );
  });

  it('reports the output it could not parse', () => {
    expect(() => collectRouteFiles('not json')).toThrow(/Could not parse the route table/);
  });
});
