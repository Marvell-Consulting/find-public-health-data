# @fphd/public-api-features

Every route on the public API surface, and the wire contract the web loaders validate against.
`publicApiRoutes` is mounted by both `public-api` and `internal-api`, so the internal API is a
superset of the public one by construction.

Built package.

| Entry         | Purpose                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `.`           | `publicApiRoutes`, and `areasRouter`, `indicatorsRouter`, `topicsRouter` individually         |
| `./contract`  | The zod schemas and inferred types for every response body; `@fphd/public-web-features` parses API responses with them |

Route handlers never build queries. They call repository methods from `createRepositories` in
`@fphd/db`.
