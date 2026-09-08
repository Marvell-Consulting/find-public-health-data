# @fphd/api-server

The Express app both API apps are built from. `public-api` and `internal-api` each call
`createApiApp`, mount `publicApiRoutes` from `@fphd/public-api-features` (and, for the internal
app, `internalApiRoutes`), then `addNotFoundHandler` and `startServer`.

Built package; consumed by the API apps and by `@fphd/internal-api-features`.

| Export                | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `createApiApp`        | `createBaseApp` from `@fphd/express` plus request logging, JSON bodies and the `/api` descriptor |
| `addNotFoundHandler`  | The JSON `not_found` fallback, mounted after every router                     |
| `requireJwtRole`      | Middleware that reads the session cookie, verifies the JWT and checks a role  |
| `serverLogging`, `startServer` | Re-exported from `@fphd/express` so an API app depends on this package alone |
