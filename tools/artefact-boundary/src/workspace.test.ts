import { describe, expect, it } from 'vitest';

import {
  collectDependencyClosure,
  parseWorkspaceDirs,
  type WorkspacePackage,
} from './workspace.js';

function workspace(...packages: Array<[string, string[]]>): Map<string, WorkspacePackage> {
  return new Map(
    packages.map(([name, dependencies]) => [name, { name, dir: `/repo/${name}`, dependencies }]),
  );
}

describe('collectDependencyClosure', () => {
  it('reaches dependencies transitively, excluding the entry itself', () => {
    const packages = workspace(
      ['@fphd/public-web', ['@fphd/ui', 'react']],
      ['@fphd/ui', ['@fphd/logger']],
      ['@fphd/logger', []],
    );

    expect(collectDependencyClosure('@fphd/public-web', packages)).toEqual([
      '@fphd/logger',
      '@fphd/ui',
    ]);
  });

  it('follows only workspace packages', () => {
    const packages = workspace(['@fphd/public-api', ['express', 'pino']]);

    expect(collectDependencyClosure('@fphd/public-api', packages)).toEqual([]);
  });

  it('terminates on a dependency cycle without reporting the entry', () => {
    const packages = workspace(
      ['@fphd/public-web', ['@fphd/ui']],
      ['@fphd/ui', ['@fphd/public-web']],
    );

    expect(collectDependencyClosure('@fphd/public-web', packages)).toEqual(['@fphd/ui']);
  });

  // A dependency outside the workspace is third-party and cannot reach back into this repo, so it
  // is skipped. An entry outside it is a check that would inspect nothing and report clean, which
  // is the failure this whole tool exists to prevent — so that one throws.
  it('throws for an entry that is not a workspace package', () => {
    expect(() => collectDependencyClosure('@fphd/renamed', workspace(['@fphd/ui', []]))).toThrow(
      /not a workspace package/,
    );
  });
});

describe('parseWorkspaceDirs', () => {
  it('reads the directory of every workspace glob', () => {
    const yaml = ['packages:', '  - apps/*', '  - packages/*', '  - tools/*', ''].join('\n');

    expect(parseWorkspaceDirs(yaml, 'pnpm-workspace.yaml')).toEqual([
      { dir: 'apps', isPackage: false },
      { dir: 'packages', isPackage: false },
      { dir: 'tools', isPackage: false },
    ]);
  });

  // pnpm treats a bare entry as an exact directory that is itself a package.
  it('reads a bare directory entry as a single package', () => {
    const yaml = ['packages:', '  - apps/*', '  - e2e', ''].join('\n');

    expect(parseWorkspaceDirs(yaml, 'pnpm-workspace.yaml')).toEqual([
      { dir: 'apps', isPackage: false },
      { dir: 'e2e', isPackage: true },
    ]);
  });

  it('ignores the rest of the file', () => {
    const yaml = ['overrides:', '  postcss: ">=8.5.18"', 'packages:', '  - apps/*', ''].join('\n');

    expect(parseWorkspaceDirs(yaml, 'pnpm-workspace.yaml')).toEqual([
      { dir: 'apps', isPackage: false },
    ]);
  });

  // Expanding a glob this check does not understand would quietly narrow what it inspects.
  it.each(['packages/**', './apps/*', 'packages/*/*', 'e2e/'])('throws for the glob %s', (glob) => {
    expect(() => parseWorkspaceDirs(`packages:\n  - ${glob}\n`, 'pnpm-workspace.yaml')).toThrow(
      /cannot expand/,
    );
  });

  it.each([
    ['packages: []', /declares no workspace packages/],
    ['overrides: {}', /declares no workspace packages/],
  ])('throws when %s declares nothing to walk', (yaml, message) => {
    expect(() => parseWorkspaceDirs(yaml, 'pnpm-workspace.yaml')).toThrow(message);
  });
});
