/**
 * The other public identifier, beside the slug: `indicator.short_id`. On its own subpath,
 * like `slug.ts`, so a browser bundle can import it without `env.ts`.
 */

/** A run of digits: what a short id looks like in a URL, and what a slug never is. */
export const SHORT_ID_PATTERN = /^\d+$/;

/** `short_id` is a Postgres integer, so a larger number addresses no indicator. */
export const MAX_SHORT_ID = 2_147_483_647;

/** Whether a path segment or query value is a short id the database could hold. */
export function isShortId(value: string): boolean {
  return SHORT_ID_PATTERN.test(value) && Number(value) <= MAX_SHORT_ID;
}
