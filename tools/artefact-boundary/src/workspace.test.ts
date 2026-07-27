import { describe, expect, it } from 'vitest';

import { collectDependencyClosure, type WorkspacePackage } from './workspace.js';

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
    const packages = workspace(['a', ['b']], ['b', ['a']]);

    expect(collectDependencyClosure('a', packages)).toEqual(['b']);
  });

  // An empty closure is indistinguishable from a clean one, so a renamed app must not pass by
  // simply no longer being found.
  it('throws for an entry that is not a workspace package', () => {
    expect(() => collectDependencyClosure('@fphd/renamed', workspace(['@fphd/ui', []]))).toThrow(
      /not a workspace package/,
    );
  });
});
