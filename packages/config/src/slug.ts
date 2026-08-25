/**
 * One slug rule for the whole service: lowercase words separated by single hyphens. It lives
 * here because both the database schemas and the wire contracts apply it, and those packages
 * cannot depend on one another. On its own subpath, like `zod.ts`, so a package that is not a
 * Node runtime can import it without pulling in `env.ts`.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
