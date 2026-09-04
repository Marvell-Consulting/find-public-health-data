/**
 * The one slug rule, shared by the database schemas and the wire contracts. On its own
 * subpath, like `zod.ts`, so a package that is not a Node runtime can import it without `env.ts`.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
