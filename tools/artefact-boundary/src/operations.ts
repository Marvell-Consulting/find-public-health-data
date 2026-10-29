import type { WorkspacePackage } from './workspace.ts';

/**
 * Packages only the operations image may ship: the migrations, the core data import, seeding and
 * the data files they read. A server app that reached one would carry them into its image.
 */
const OPERATIONS_PACKAGES = ['@fphd/db-operations'];

/**
 * A name missing from the workspace throws rather than matching nothing: after a rename, an empty
 * result is indistinguishable from a clean one, so the check would silently stop checking.
 */
export function findOperationsPackages(
  closure: readonly string[],
  packages: ReadonlyMap<string, WorkspacePackage>,
): string[] {
  for (const name of OPERATIONS_PACKAGES) {
    if (!packages.has(name)) {
      throw new Error(`${name} is not a workspace package; the operations check cannot run.`);
    }
  }
  return [...new Set(closure.filter((name) => OPERATIONS_PACKAGES.includes(name)))].sort();
}
