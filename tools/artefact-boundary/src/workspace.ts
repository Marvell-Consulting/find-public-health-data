import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

export type WorkspacePackage = {
  name: string;
  dir: string;
  dependencies: string[];
};

export type WorkspaceDir = {
  dir: string;
  // A bare `<dir>` entry is itself a package; a `<dir>/*` glob holds packages as its children.
  isPackage: boolean;
};

/**
 * The directories pnpm itself treats as the workspace, so a glob added there cannot be missed here.
 * A directory this did not know about would drop its packages from every closure, and a dependency
 * on one of them would read as third-party and be skipped — a false negative in the one check that
 * must not have any.
 */
export async function readWorkspaceDirs(repoRoot: string): Promise<WorkspaceDir[]> {
  const file = path.join(repoRoot, 'pnpm-workspace.yaml');
  return parseWorkspaceDirs(await readFile(file, 'utf8'), file);
}

export function parseWorkspaceDirs(yaml: string, file: string): WorkspaceDir[] {
  const parsed: unknown = parse(yaml);
  const { packages } = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
    packages?: unknown;
  };

  if (!Array.isArray(packages) || packages.length === 0) {
    throw new Error(`${file} declares no workspace packages; nothing can be checked.`);
  }

  return packages.map((glob) => {
    if (typeof glob === 'string' && !glob.startsWith('!')) {
      const globDir = /^([^*/]+)\/\*$/.exec(glob)?.[1];
      if (globDir !== undefined) return { dir: globDir, isPackage: false };
      if (/^[^*/]+$/.test(glob)) return { dir: glob, isPackage: true };
    }
    throw new Error(
      `${file} declares the workspace glob ${JSON.stringify(glob)}, which this check cannot expand.`,
    );
  });
}

export async function readWorkspacePackages(
  repoRoot: string,
): Promise<Map<string, WorkspacePackage>> {
  const workspaceDirs = await readWorkspaceDirs(repoRoot);
  const manifests = await Promise.all(
    workspaceDirs.map(async ({ dir, isPackage }) => {
      const parent = path.join(repoRoot, dir);
      if (isPackage) {
        const pkg = await readManifest(parent);
        // Unlike a glob's childless directory, a bare entry names one package; nothing there
        // means this check is inspecting less than pnpm resolves.
        if (pkg === null) {
          throw new Error(
            `The workspace entry ${dir} does not resolve to a package: no package.json, or one without a valid "name".`,
          );
        }
        return [pkg];
      }
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
  const file = path.join(dir, 'package.json');
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return null;
  }

  // A directory with no manifest is not a package; a manifest that will not parse is a broken one,
  // and swallowing it here would drop that package out of every closure silently.
  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Could not parse the manifest at ${file}.`, { cause });
  }

  if (typeof manifest !== 'object' || manifest === null) return null;
  const { name, dependencies } = manifest as {
    name?: unknown;
    dependencies?: Record<string, unknown>;
  };
  if (typeof name !== 'string') return null;

  return { name, dir, dependencies: Object.keys(dependencies ?? {}) };
}

/**
 * Every workspace package reachable from `entry`, excluding `entry` itself — a dependency cycle
 * would otherwise reach back to it. Only workspace packages are followed: a third-party dependency
 * cannot reach back into this repo.
 *
 * An unknown `entry` throws rather than returning nothing: an empty closure is indistinguishable
 * from a clean one, so a renamed app would silently stop being checked.
 */
export function collectDependencyClosure(
  entry: string,
  packages: ReadonlyMap<string, WorkspacePackage>,
): string[] {
  if (!packages.has(entry)) {
    throw new Error(`${entry} is not a workspace package; it cannot be checked.`);
  }

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

  reached.delete(entry);
  return [...reached].sort();
}
