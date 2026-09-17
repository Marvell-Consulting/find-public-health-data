/**
 * The one slug rule, shared by the database schemas and the wire contracts. On its own
 * subpath, like `zod.ts`, so a package that is not a Node runtime can import it without `env.ts`.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const DIGITS_ONLY = /^\d+$/;

/**
 * A title as a slug: lowercased, whitespace runs hyphenated, anything outside the slug
 * alphabet dropped, and repeated or trailing hyphens collapsed. There is no length cap and
 * no transliteration, so a title of nothing but punctuation slugifies to the empty string
 * and the caller decides what to do about it.
 *
 * A digits-only result takes the suffix `-indicator`, because a slug of digits is how an
 * indicator's number is written.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return DIGITS_ONLY.test(slug) ? `${slug}-indicator` : slug;
}
