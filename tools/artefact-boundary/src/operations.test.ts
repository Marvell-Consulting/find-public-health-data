import { describe, expect, it } from 'vitest';

import { findOperationsPackages } from './operations.ts';
import { collectDependencyClosure, type WorkspacePackage } from './workspace.ts';

function workspace(...packages: Array<[string, string[]]>): Map<string, WorkspacePackage> {
  return new Map(
    packages.map(([name, dependencies]) => [
      name,
      { name, dir: `/repo/${name}`, dependencies, devDependencies: [] },
    ]),
  );
}

describe('findOperationsPackages', () => {
  it('flags @fphd/db-operations reached through another package', () => {
    const packages = workspace(
      ['@fphd/internal-api', ['@fphd/internal-api-features']],
      ['@fphd/internal-api-features', ['@fphd/db-operations']],
      ['@fphd/db-operations', ['@fphd/db']],
      ['@fphd/db', []],
    );

    expect(
      findOperationsPackages(
        collectDependencyClosure('@fphd/internal-api', packages, { bundled: false }),
        packages,
      ),
    ).toEqual(['@fphd/db-operations']);
  });

  it('passes a closure holding only the read side', () => {
    const packages = workspace(
      ['@fphd/internal-api', ['@fphd/db']],
      ['@fphd/db', []],
      ['@fphd/db-operations', ['@fphd/db']],
    );

    expect(
      findOperationsPackages(
        collectDependencyClosure('@fphd/internal-api', packages, { bundled: false }),
        packages,
      ),
    ).toEqual([]);
  });

  it('throws when the workspace has no @fphd/db-operations to look for', () => {
    const packages = workspace(['@fphd/internal-api', ['@fphd/db']], ['@fphd/db', []]);

    expect(() => findOperationsPackages(['@fphd/db'], packages)).toThrow(
      '@fphd/db-operations is not a workspace package',
    );
  });
});
