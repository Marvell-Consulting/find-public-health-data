const INTERNAL_PACKAGE = /@fphd\/internal-[a-z0-9-]+/;
// Any *directory* named `internal-…`, not merely `apps/internal-…`, because a relative cross-app
// import emitted from `apps/public-api/dist` reads `../../internal-api/src/…` — no `apps/` segment
// survives. The trailing separator is what keeps `src/internal-helpers.ts` out of scope.
const INTERNAL_DIRECTORY = /(?:^|[\\/])internal-[a-z0-9-]+[\\/]/;

/**
 * A module reference — an import specifier, a sourcemap `sources` entry, or a workspace package
 * name — that resolves to internal-only code.
 */
export function isInternalReference(reference: string): boolean {
  return INTERNAL_PACKAGE.test(reference) || INTERNAL_DIRECTORY.test(reference);
}

export function findInternalReferences(references: readonly string[]): string[] {
  return [...new Set(references.filter(isInternalReference))].sort();
}
