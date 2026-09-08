# @fphd/logger

`createLogger({ name, level, pretty })` returns a pino logger with the service name on every
line. `pretty` is for local development only; the transport it names is a devDependency and is
never resolved in production or in the browser.

Built package with a `browser` export condition, so the same module serves Node and the web
bundles. Everything that logs goes through this package; see `agent-docs/logging.md` for what
is and is not logged.
