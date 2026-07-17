# Find Public Health Data

A pnpm monorepo containing four independently deployable applications:

| Application | Package | Default port |
| --- | --- | ---: |
| Public web | `@fphd/public-web` | 3000 |
| Internal web | `@fphd/internal-web` | 3001 |
| Public API | `@fphd/public-api` | 4000 |
| Internal API | `@fphd/internal-api` | 4001 |

The internal applications are functional supersets of the public applications through shared
workspace packages. Deployable applications do not import one another.

## Requirements

- Node.js 24.18.0 LTS
- pnpm 11.11.0
- Docker, to run the development database

Corepack will select the pinned pnpm version from `package.json`.

## Getting started

```sh
cp .env.example .env    # required — see Configuration below
pnpm install
docker compose up -d    # start the development database
pnpm dev
```

## Configuration

Environment variables are read from a `.env` file at the repository root. `.env` is not committed;
`.env.example` lists every variable with development-safe values, so copying it is enough to get a
working local setup.

The three passwords (`POSTGRES_PASSWORD`, `PUBLIC_API_PASSWORD`, `INTERNAL_API_PASSWORD`) have **no
default**. If any is unset or empty, `docker compose` fails with a message naming the variable
rather than creating a database role with a well-known password. This means `docker compose up`
will not work without a `.env`.

## Commands

```sh
pnpm install
pnpm dev
pnpm dev:public
pnpm dev:internal
pnpm check
pnpm build
pnpm test              # all three tiers below, in order
pnpm test:unit         # unit tests
pnpm test:integration  # integration tests — none exist yet
pnpm test:e2e          # end-to-end tests — none exist yet
```

Each application builds to its own `dist` directory, giving CI and deployment tooling four
unambiguous artifacts.

## Continuous integration

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, integration tests, e2e tests,
`pnpm audit` and build as parallel jobs. A final `All checks pass` job aggregates them and is the
single required status check for merging, so the required-check list does not need editing whenever
a job is added — but a new job must be added to that job's `needs` list, or it gates nothing.

Runs are triggered on every non-draft pull request (on open, on every push to the branch, and when a
draft is marked ready for review) and on every push to `main`. **Draft pull requests run nothing.**

`pnpm check` is the local equivalent for lint, typecheck, test and build. It runs `pnpm test`, so it
covers all three test tiers — which today costs nothing, but once integration tests exist `pnpm check`
will need the database running. CI additionally runs `pnpm audit --audit-level high`, which fails on
high and critical advisories, so a newly published advisory can redden a pull request that changed
nothing. Where a real advisory has no fix and blocks all work, `pnpm.auditConfig.ignoreGhsas` is the
escape hatch; each entry is a reviewable decision.

Each tier is its own CI job, so the jobs run `pnpm test:unit`, `pnpm test:integration` and
`pnpm test:e2e` individually rather than `pnpm test`.

**There are no integration or e2e tests yet**, so those two jobs execute zero tests — their check
names say so. They get there differently, which matters when reading their logs:

- `pnpm test:integration` fans out to all six testing packages and runs Vitest in each. Every run
  passes because of `--passWithNoTests`, not because nothing ran.
- `pnpm test:e2e` matches no package at all. It is the only tier carrying `--if-present`, which is
  what makes it a no-op rather than an error; drop the flag once an e2e package exists.

To add real ones:

- An integration test is any `*.integration.test.ts`, colocated in `src/` like a unit test. Each
  package's own `test` script already excludes the pattern and its `test:integration` script selects
  it. (`test:unit` exists only at the root, where it fans out to those per-package `test` scripts —
  a per-package `test:unit` would let a package that never defined one drop out of CI silently.)
  The integration job has a Postgres service and creates the per-API login roles, so a test needing
  the database should work without touching the workflow — except that `pnpm db:migrate` still needs
  adding to the job once a first migration exists.
- E2e tests will live in a new top-level `e2e` workspace package, not in `packages/*`: a package
  there is shared code the applications are built from, which an e2e suite is not. It would drive
  applications over HTTP, choosing which by base-URL environment variables rather than by importing
  them.

Every job runs the whole workspace rather than only the changed packages. When CI wall-clock starts
to hurt, `pnpm --filter "...[origin/main]"` selects changed packages plus their dependents, with no
extra tooling. Two caveats: it needs `fetch-depth: 0` on checkout, and it understands only the
dependency graph — a change to a root file such as `tsconfig.base.json` or `biome.json` selects
nothing, so it needs a full-run fallback. Filter inside the job with pnpm rather than with
workflow-level `paths:` filters, which produce skipped jobs that branch protection reads as
satisfied.

## Database

A PostgreSQL 18 container defined in `compose.yaml`, for local development only — it is not
deployed.

```sh
docker compose up -d      # start
docker compose down       # stop
docker compose down -v    # stop and delete all data
```

Each API connects with its own login role (`public_api`, `internal_api`) rather than as the owner,
so access can be constrained per audience at the grant level. The roles are created on first
startup by `docker/postgres/initdb/01-roles.sh`, which runs only when the data volume is empty — so
changes to it require `docker compose down -v` to take effect.

Schema and migrations are managed with Drizzle in `packages/db`:

```sh
pnpm db:generate    # generate a migration from the schema
pnpm db:migrate     # apply pending migrations
pnpm db:studio      # browse the database
```

There is no schema yet, and no grants beyond the ability to log in.

## Structure

```text
apps/
  public-web/
  internal-web/
  public-api/
  internal-api/
packages/
  db/
  logger/
  ui/
  public-web-features/
  internal-web-features/
```

Application directories contain deployment wiring, routes, and entrypoints. Reusable business and
feature logic belongs in workspace packages.
