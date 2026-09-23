import type { UIMatch } from 'react-router';
import { describe, expect, it } from 'vitest';

import { backHrefFrom, backLinkHandle } from './back-link-handle.ts';

function match(overrides: Partial<UIMatch>): UIMatch {
  return {
    id: 'route',
    pathname: '/',
    params: {},
    loaderData: undefined,
    handle: undefined,
    ...overrides,
  };
}

const root = match({ id: 'root' });

describe('backHrefFrom', () => {
  it('finds nothing when no route declares a back link', () => {
    expect(backHrefFrom([root, match({ id: 'leaf', handle: { other: true } })])).toBeUndefined();
  });

  it('takes a fixed back link as declared', () => {
    const handle = backLinkHandle('/dashboard');

    expect(backHrefFrom([root, match({ id: 'leaf', handle })])).toBe('/dashboard');
  });

  it('derives a back link from the loader data', () => {
    const handle = backLinkHandle<{ id: string }>((data) => `/dashboard/indicators/${data.id}`);

    expect(backHrefFrom([root, match({ id: 'leaf', handle, loaderData: { id: 'abc' } })])).toBe(
      '/dashboard/indicators/abc',
    );
  });

  it('leaves a data-derived back link out when the loader did not run', () => {
    const handle = backLinkHandle<{ id: string }>((data) => data.id);

    expect(backHrefFrom([root, match({ id: 'leaf', handle })])).toBeUndefined();
  });

  it('prefers the deepest route that declares one', () => {
    const parent = match({ id: 'parent', handle: backLinkHandle('/a') });
    const leaf = match({ id: 'leaf', handle: backLinkHandle('/b') });

    expect(backHrefFrom([root, parent, leaf])).toBe('/b');
    expect(backHrefFrom([root, parent, match({ id: 'plain' })])).toBe('/a');
  });
});
