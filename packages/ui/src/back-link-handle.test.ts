import type { UIMatch } from 'react-router';
import { describe, expect, it } from 'vitest';

import { backLinkFrom, backLinkHandle } from './back-link-handle.ts';

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

describe('backLinkFrom', () => {
  it('finds nothing when no route declares a back link', () => {
    expect(backLinkFrom([root, match({ id: 'leaf', handle: { other: true } })])).toBeUndefined();
  });

  it('takes a fixed back link as declared', () => {
    const handle = backLinkHandle({ href: '/dashboard', text: 'Back to indicators' });

    expect(backLinkFrom([root, match({ id: 'leaf', handle })])).toEqual({
      href: '/dashboard',
      text: 'Back to indicators',
    });
  });

  it('derives a back link from the loader data', () => {
    const handle = backLinkHandle<{ id: string }>((data) => ({
      href: `/dashboard/indicators/${data.id}`,
      text: 'Back to indicator overview',
    }));

    expect(backLinkFrom([root, match({ id: 'leaf', handle, loaderData: { id: 'abc' } })])).toEqual({
      href: '/dashboard/indicators/abc',
      text: 'Back to indicator overview',
    });
  });

  it('leaves a data-derived back link out when the loader did not run', () => {
    const handle = backLinkHandle<{ id: string }>((data) => ({ href: data.id, text: 'Back' }));

    expect(backLinkFrom([root, match({ id: 'leaf', handle })])).toBeUndefined();
  });

  it('prefers the deepest route that declares one', () => {
    const parent = match({ id: 'parent', handle: backLinkHandle({ href: '/a', text: 'A' }) });
    const leaf = match({ id: 'leaf', handle: backLinkHandle({ href: '/b', text: 'B' }) });

    expect(backLinkFrom([root, parent, leaf])).toEqual({ href: '/b', text: 'B' });
    expect(backLinkFrom([root, parent, match({ id: 'plain' })])).toEqual({ href: '/a', text: 'A' });
  });
});
