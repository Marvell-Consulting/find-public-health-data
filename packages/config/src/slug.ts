/**
 * The one slug rule, shared by the database schemas and the wire contracts. On its own
 * subpath, like `zod.ts`, so a package that is not a Node runtime can import it without `env.ts`.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Room for a whole indicator name: Fingertips names run to about 180 characters, and cutting
 * shorter makes names that differ only in their tail collide.
 */
export const SLUG_MAX_LENGTH = 200;

/**
 * The literal path segments that sit beside the slug parameter in the public API and web
 * route tables, so a slug can never address a different route. `compare` covers the
 * `indicators/compare.csv` download and the page that would sit beside it.
 */
export const RESERVED_SLUGS: readonly string[] = ['compare', 'facets', 'search'];

export function isReservedSlug(value: string): boolean {
  return RESERVED_SLUGS.includes(value);
}

/**
 * The slug a name yields: lower case, accents folded to their plain letters, whitespace,
 * dashes and slashes to a single hyphen, every other character outside `[a-z0-9-]`
 * dropped, hyphen runs collapsed and trimmed, and the result cut to SLUG_MAX_LENGTH on a
 * word boundary. A name that leaves nothing usable yields the empty string — `slugProblem`
 * names why.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    // A decomposed accent is a combining mark, so dropping the marks leaves the letter.
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    // A dash or a slash separates words as a space does: "and/or", "0–4 years".
    .replace(/[\s\u2010-\u2015/\\]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length <= SLUG_MAX_LENGTH ? slug : cutToWordBoundary(slug);
}

function cutToWordBoundary(slug: string): string {
  const overlong = slug.slice(0, SLUG_MAX_LENGTH + 1);
  const boundary = overlong.lastIndexOf('-');
  // A first word longer than the limit has no boundary to cut on, so it is cut short.
  const cut = boundary === -1 ? overlong.slice(0, SLUG_MAX_LENGTH) : overlong.slice(0, boundary);

  return cut.replace(/-+$/, '');
}

/** Why a name cannot carry a slug: nothing usable, a short id in disguise, or a route. */
export type SlugProblem = 'empty' | 'digits' | 'reserved';

/** The reason a name yields no usable slug, or undefined when it does. */
export function slugProblem(name: string): SlugProblem | undefined {
  const slug = slugify(name);

  if (slug === '') return 'empty';
  if (/^\d+$/.test(slug)) return 'digits';
  if (isReservedSlug(slug)) return 'reserved';

  return undefined;
}
