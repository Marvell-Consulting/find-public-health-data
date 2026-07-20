import { describe, expect, it } from 'vitest';

import { findInternalReferences, isInternalReference } from './internal.js';

describe('isInternalReference', () => {
  it.each([
    '@fphd/internal-web-features',
    '@fphd/internal-api',
    '../../packages/internal-web-features/src/index.tsx',
    '../../apps/internal-web/src/router.tsx',
    '/home/runner/work/fphd/packages/internal-web-features/src/index.tsx',
    'packages\\internal-web-features\\src\\index.tsx',
    '/node_modules/.pnpm/file+packages+internal-web-features/node_modules/@fphd/internal-web-features/src/index.tsx',
    // Emitted from apps/public-api/dist, a relative cross-app import keeps no `apps/` segment.
    '../../internal-api/src/secret.js',
  ])('flags %s', (reference) => {
    expect(isInternalReference(reference)).toBe(true);
  });

  it.each([
    '@fphd/public-web-features',
    '@fphd/ui',
    'react-router',
    '../../packages/ui/src/app-shell.tsx',
    // Neither is internal code: the match is on a directory named `internal-…`.
    '../../packages/ui/src/internal-helpers.ts',
    '../../packages/public-web-features/src/internal/util.ts',
  ])('allows %s', (reference) => {
    expect(isInternalReference(reference)).toBe(false);
  });
});

describe('findInternalReferences', () => {
  it('returns the offending references, deduplicated and sorted', () => {
    expect(
      findInternalReferences([
        '@fphd/ui',
        '@fphd/internal-web-features',
        'react',
        '@fphd/internal-web-features',
        '@fphd/internal-api',
      ]),
    ).toEqual(['@fphd/internal-api', '@fphd/internal-web-features']);
  });

  it('returns nothing for a clean public reference list', () => {
    expect(findInternalReferences(['@fphd/ui', '@fphd/public-web-features', 'react'])).toEqual([]);
  });
});
