import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_DIRS = ['apps', 'packages', 'tools'];

export type WorkspacePackage = {
  name: string;
  dir: string;
  dependencies: string[];
};

export async function readWorkspacePackages(
  repoRoot: string,
): Promise<Map<string, WorkspacePackage>> {
  const manifests = await Promise.all(
    WORKSPACE_DIRS.map(async (workspaceDir) => {
      const parent = path.join(repoRoot, workspaceDir);
      const entries = await readdir(parent, { withFileTypes: true });
      return Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => readManifest(path.join(parent, entry.name))),
      );
    }),
  );

  return new Map(
    manifests
      .flat()
      .filter((pkg) => pkg !== null)
      .map((pkg) => [pkg.name, pkg]),
  );
}

async function readManifest(dir: string): Promise<WorkspacePackage | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(dir, 'package.json'), 'utf8');
  } catch {
    return null;
  }

  const manifest: unknown = JSON.parse(raw);
  if (typeof manifest !== 'object' || manifest === null) return null;
  const { name, dependencies } = manifest as {
    name?: unknown;
    dependencies?: Record<string, unknown>;
  };
  if (typeof name !== 'string') return null;

  return { name, dir, dependencies: Object.keys(dependencies ?? {}) };
}

/**
 * Every workspace package reachable from `entry`, excluding `entry` itself. Only workspace
 * packages are followed — a third-party dependency cannot reach back into this repo.
 */
export function collectDependencyClosure(
  entry: string,
  packages: ReadonlyMap<string, WorkspacePackage>,
): string[] {
  const reached = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) break;
    for (const dependency of packages.get(current)?.dependencies ?? []) {
      if (!packages.has(dependency) || reached.has(dependency)) continue;
      reached.add(dependency);
      queue.push(dependency);
    }
  }

  return [...reached].sort();
}
