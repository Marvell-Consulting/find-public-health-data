/**
 * Packages only the operations image may ship: the migrations, the core data import, seeding and
 * the data files they read. A server app that reached one would carry them into its image.
 */
const OPERATIONS_PACKAGES = new Set(['@fphd/db-operations']);

export function findOperationsPackages(closure: readonly string[]): string[] {
  return [...new Set(closure.filter((name) => OPERATIONS_PACKAGES.has(name)))].sort();
}
