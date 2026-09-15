# @fphd/internal-api-features

Routes and repository functions only `internal_api` may run: today, topic administration and the
indicators dashboard listing. The
`internal-` prefix is what `tools/artefact-boundary` keys on, so nothing here can reach a public
image.

Built package; consumed by `internal-api`, and by `@fphd/internal-web-features` for the contract.

| Entry         | Purpose                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------- |
| `.`           | `internalApiRoutes` (every internal route in one router), `internalTopicsRouter`, `createInternalRepositories` and the repository types |
| `./contract`  | The zod schemas and inferred types for the internal API's request and response bodies, shared with the internal web loaders |
| `./testing`   | `createFakeInternalRepositories` for handler tests                                            |

Queries live in this package's repository files rather than `@fphd/db`, whose default export is
the public read surface.
