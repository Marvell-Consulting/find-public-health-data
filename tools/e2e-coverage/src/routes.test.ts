import { describe, expect, it } from 'vitest';

import { collectRoutes } from './routes.js';

const routeTable = JSON.stringify([
  {
    id: 'root',
    path: '',
    file: 'root.tsx',
    children: [
      { id: 'home', index: true, file: './home.tsx' },
      { id: 'sign-in', path: 'sign-in', file: './sign-in.tsx' },
      {
        id: 'authenticated',
        file: './authenticated.tsx',
        children: [
          { id: 'topic', path: 'topics/:slug', file: '../topic/route.tsx' },
          {
            id: 'publisher',
            file: './publisher.tsx',
            children: [{ id: 'manage', path: 'manage', file: './manage.tsx' }],
          },
        ],
      },
      { id: 'catch-all', path: '*', file: '../not-found-route.tsx' },
    ],
  },
]);

describe('collectRoutes', () => {
  it('collects every matchable route with its module, pathless layouts contributing nothing', () => {
    expect(collectRoutes(routeTable)).toEqual([
      { path: '/', file: './home.tsx' },
      { path: '/sign-in', file: './sign-in.tsx' },
      { path: '/topics/:slug', file: '../topic/route.tsx' },
      { path: '/manage', file: './manage.tsx' },
      { path: '/*', file: '../not-found-route.tsx' },
    ]);
  });

  it('prefixes a child with its pathful parent', () => {
    const nested = JSON.stringify([
      { path: 'manage', file: 'manage.tsx', children: [{ path: 'topics', file: 'topics.tsx' }] },
    ]);

    expect(collectRoutes(nested).map((route) => route.path)).toEqual(['/manage', '/manage/topics']);
  });

  it('resolves an index route to its parent path', () => {
    const nested = JSON.stringify([
      { path: 'manage', file: 'manage.tsx', children: [{ index: true, file: 'index.tsx' }] },
    ]);

    expect(collectRoutes(nested).map((route) => route.path)).toEqual(['/manage', '/manage']);
  });

  it('treats an empty path as a layout', () => {
    expect(collectRoutes(JSON.stringify([{ path: '', file: 'root.tsx' }]))).toEqual([]);
  });

  it('normalises stray slashes in a segment', () => {
    expect(collectRoutes(JSON.stringify([{ path: '/topics/', file: 'a.tsx' }]))).toEqual([
      { path: '/topics', file: 'a.tsx' },
    ]);
  });

  it('reports the output it could not parse', () => {
    expect(() => collectRoutes('not json')).toThrow(/Could not parse the route table/);
  });

  // A route the walk did not recognise is a route this check never looks at, so an unexpected
  // shape has to be reported rather than skipped.
  it('rejects a route table that is not an array', () => {
    expect(() => collectRoutes('{"routes":[]}')).toThrow(/not an array of routes/);
  });

  it.each(['["root.tsx"]', '[[]]'])('rejects a route that is not an object: %s', (json) => {
    expect(() => collectRoutes(json)).toThrow(/not an object/);
  });

  it('rejects a route whose path is not a string', () => {
    expect(() => collectRoutes('[{"path":42}]')).toThrow(/path is not a string/);
  });

  it('rejects a route whose index flag is not a boolean', () => {
    expect(() => collectRoutes('[{"index":"yes"}]')).toThrow(/index flag is not a boolean/);
  });

  it('rejects a route whose file is not a string', () => {
    expect(() => collectRoutes('[{"path":"a","file":42}]')).toThrow(/file is not a string/);
  });

  it('rejects a matchable route with no module', () => {
    expect(() => collectRoutes('[{"path":"a"}]')).toThrow(/matchable route with no module/);
  });

  it('rejects an unexpected shape nested in children', () => {
    expect(() => collectRoutes('[{"path":"a","file":"a.tsx","children":{}}]')).toThrow(
      /not an array of routes/,
    );
  });
});
