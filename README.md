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

Alongside them sits `@fphd/operations`, which serves no traffic and has no port. It is a
command-line application, run as a job — see [Operational commands](#operational-commands).

## Requirements

- Node.js 24+
- pnpm 11.18.0
- Docker, to run the development database

Corepack will select the pinned pnpm version from `package.json`.

## Getting started

```sh
cp .env.example .env    # required — see Configuration below
pnpm install
pnpm services:up        # start the development database and wait for it
pnpm db:bootstrap       # once per fresh database: create the per-API login roles
pnpm dev
```

`pnpm dev` (and `dev:public`, `dev:internal`, `dev:mixed`) starts the Docker services it needs and
waits for them to report healthy before running any app, so no separate `docker compose up` is
needed. A **brand-new** database is empty until migrated — see [Database](#database).

## Configuration

Environment variables are read from a `.env` file at the repository root. `.env` is not committed;
`.env.example` lists every variable with development-safe values, so copying it is enough to get a
working local setup.

The three passwords (`POSTGRES_PASSWORD`, `PUBLIC_API_PASSWORD`, `INTERNAL_API_PASSWORD`) have **no
default**. If any is unset or empty, the command that needs it — `docker compose` for the first,
`pnpm db:bootstrap` and the app containers for the other two — fails with a message naming the
variable rather than creating a database role with a well-known password.

`APP_ENV` names the environment: `local` | `test` | `dev` | `preview` | `production`. It has **no
default either**, and for the same reason. `local` is a developer machine and `test` a test run or
CI job; both mean everything is on this machine over http, so both relax settings that must hold
when deployed — database TLS and secure session cookies. A default could only be `local`, which
would let an unset variable pick the relaxed side in silence. Every runtime supplies it: `.env` for
development, `compose.yaml` for the containers, the `test:integration` script for test runs, and the
platform for deployed services.

`DB_TLS` turns TLS to the database on or off. Left unset it follows `APP_ENV`: off for `local` and
`test`, where the database is the compose container and presents no certificate, and on everywhere
else, because every managed Postgres this deploys to requires it. Certificates are verified against
Node's CA store — so it is not a way to accept an unknown certificate, and no CA bundle has to be
shipped. Set it only to override the default in a deployed environment.

`SESSION_JWT_SECRET` signs JWT session cookies issued by the authentication backend. The example
value is for local development only; each deployed service must receive a secret of at least 32
bytes from the deployment environment. Services issuing and validating a session for the same
audience must receive the same secret. Web applications validate the JWT before exposing its
subject and roles to route middleware, and personalized responses are marked private and
non-cacheable.

Authentication currently uses fixed fake users. The sign-in form posts to the web backend, which
creates a one-use authorization code; its callback exchanges that code for an eight-hour JWT
cookie. Public routes remain available anonymously. Internal routes redirect to sign in and accept
only fake users carrying the `internal` role. Public-service sessions contain public roles only,
even when the selected fake identity also has internal permissions. Internal viewers can use the
internal service, while the management navigation and `/manage` route require the `publisher` role.
The public surface of the internal API remains open, but `/api/internal` independently validates
the JWT and requires the internal role. Sign-out clears the JWT cookie.

## Commands

```sh
pnpm install
pnpm dev
pnpm dev:public
pnpm dev:internal
pnpm check
pnpm check:artefacts   # assert no internal code reaches the public artifacts
pnpm build
pnpm test              # all three tiers below, in order
pnpm test:unit         # unit tests
pnpm test:integration  # integration tests — need the local database running
pnpm test:e2e          # end-to-end tests — need the stack serving and the database seeded
```

Each application builds to its own `dist` directory, giving CI and deployment tooling four
unambiguous artifacts.

## Continuous integration

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, integration tests, e2e tests,
`pnpm audit`, build and the public artifact boundary check as parallel jobs. A final `All checks
pass` job aggregates them and is the single required status check for merging, so the required-check
list does not need editing whenever a job is added — but a new job must be added to that job's
`needs` list, or it gates nothing.

Runs are triggered on every non-draft pull request (on open, on every push to the branch, and when a
draft is marked ready for review) and on every push to `main`. **Draft pull requests run nothing.**

`pnpm check` is the local equivalent for lint, typecheck, test and build. It runs `pnpm test`, so it
covers all three test tiers — which means `pnpm check` needs the local database running
(`docker compose up -d db`) for the integration tier, and the apps serving with the database seeded
for the e2e tier (see the e2e notes below). CI additionally runs `pnpm audit --audit-level high`, which fails on
high and critical advisories, so a newly published advisory can redden a pull request that changed
nothing. Where a real advisory has no fix and blocks all work, `pnpm.auditConfig.ignoreGhsas` is the
escape hatch; each entry is a reviewable decision.

Each tier is its own CI job, so the jobs run `pnpm test:unit`, `pnpm test:integration` and
`pnpm test:e2e` individually rather than `pnpm test`.

- `pnpm test:integration` runs Vitest over every project, selecting `integration.test` files. A
  project without any still passes because of `--passWithNoTests`.
- `pnpm test:e2e` names the one suite directly (`pnpm --filter @fphd/e2e run test:e2e`), so broken
  e2e wiring is an error rather than a silent skip. In CI the job builds the four apps as compose
  containers, seeds the database with the same commands a developer runs, runs the suite, and
  uploads the Playwright report when it fails.

Both tiers are one root Vitest run over the projects declared in `vitest.config.ts`, globbed from
`apps/*`, `packages/*` and `tools/*`. Packages declare no test scripts of their own, so a new
package joins both tiers by existing rather than by remembering to opt in. Target one from the root:

```sh
vitest run --project @fphd/public-api        # one package
vitest run apps/public-api/src/app.test.ts   # one file
vitest run -t 'partial test name'            # one test
```

To add real ones:

- An integration test is any file whose name contains `integration.test`, colocated in `src/` like
  a unit test. Conventionally that is `<subject>.integration.test.ts`, but neither the prefix nor
  the extension is part of the contract, so `.integration.test.tsx` and a bare `integration.test.ts`
  both qualify. The two tiers are the same run under different filters — `test:unit` excludes that
  pattern and `test:integration` selects it — so a package needs no per-tier wiring.
  The integration job has a Postgres service and creates the per-API login roles. The root
  Vitest global setup (gated on `INTEGRATION_DB=1`, set by `test:integration`) builds a
  migrated, seeded template database once per run; each test file calls
  `createTestDatabase()` from `@fphd/db/testing` for its own copy, so files run in parallel
  against isolated databases and never touch the development database.
- E2e tests are Playwright specs in the top-level `e2e` workspace package (`@fphd/e2e`), not in
  `packages/*`: a package there is shared code the applications are built from, which an e2e suite
  is not. Specs drive the applications over HTTP and never import application code; the spec's
  directory picks the target — `tests/public` uses `PUBLIC_WEB_URL` (default
  `http://localhost:3000`), `tests/internal` uses `INTERNAL_WEB_URL` (default
  `http://localhost:3001`). Nothing starts the stack for the suite: serve it in another terminal
  and seed the database, then run the tests —

  ```sh
  pnpm --filter @fphd/e2e exec playwright install chromium   # once
  pnpm dev                                                   # or any dev:mixed split
  pnpm test:e2e
  ```

  `pnpm --filter @fphd/e2e exec playwright test --ui` opens UI mode, and `--headed` and `-g`
  filters pass through the same way. Specs run in parallel workers against the shared seed, so a
  spec never mutates data another spec reads — a test of a write flow creates its own rows and
  asserts on those.

Every job runs the whole workspace rather than only the changed packages. When CI wall-clock starts
to hurt, `pnpm --filter "...[origin/main]"` selects changed packages plus their dependents, with no
extra tooling. Two caveats: it needs `fetch-depth: 0` on checkout, and it understands only the
dependency graph — a change to a root file such as `tsconfig.base.json` or `biome.json` selects
nothing, so it needs a full-run fallback. Filter inside the job with pnpm rather than with
workflow-level `paths:` filters, which produce skipped jobs that branch protection reads as
satisfied.

## The public artifact boundary

`pnpm check:artefacts` (`tools/artefact-boundary`, also its own CI job) fails if internal code has
reached a public artifact. It applies four checks, cheapest first so the common failure is reported
without waiting for a build:

- the two public apps' transitive workspace dependency closures contain no `internal-*` package;
- no route module in `public-web`'s route table is internal. React Router declares routes as path
  strings rather than imports, so `route('manage', '../../packages/internal-web-features/…')` is
  invisible to an import linter — `react-router routes --json` names those paths directly;
- no import specifier in `apps/public-api/dist` resolves to internal code — this is the one that
  catches a deep relative import, which never appears in a `package.json`;
- no module in the `public-web` bundle comes from an internal package. The bundle is minified, so
  module identity survives only in sourcemaps. The check builds with `--sourcemapClient hidden
  --sourcemapServer hidden`, reads each map's `sources` across `dist/client` and `dist/server`, then
  deletes the maps: `hidden` omits the `sourceMappingURL` comment that would point at them, so what
  remains in `dist/` is byte-identical to a plain `react-router build`. React Router prints a
  "source maps are enabled in production" warning during this build; it does not apply to what
  ships, because the maps do not survive the check.

The rule the four share is "a module reference naming an `@fphd/internal-*` package or living under
a directory named `internal-*`", unit-tested in `tools/artefact-boundary/src/internal.test.ts`.

Two of the checks would pass vacuously if they silently found nothing to inspect, so both refuse to:
an app name absent from the workspace refuses to be checked rather than yielding an empty closure,
and a `dist` holding no JavaScript or no sourcemaps is an error, not a pass.

Some vectors are caught earlier than this gate: TypeScript's `rootDir` rejects a relative cross-app
import at compile time, and Biome's `noRestrictedImports` rejects one by package name. The artifact
checks are the backstop for what those cannot see, and the only thing that inspects what actually
ships.

## Database

A PostgreSQL 18 container defined in `compose.yaml`, for local development only — it is not
deployed.

```sh
pnpm services:up          # start and wait for healthy — what the dev scripts run
docker compose up -d      # start without waiting
docker compose down       # stop
docker compose down -v    # stop and delete all data
```

`pnpm services:up` starts every compose service that carries no `profiles:` key, so a service added
to `compose.yaml` without a profile becomes a dev prerequisite without the script changing. The four
app services are profile-gated and belong to `pnpm dev:mixed`.

Each API connects with its own login role (`public_api`, `internal_api`) rather than as the owner,
so access can be constrained per audience at the grant level. The roles are created by
`pnpm db:bootstrap` — run it once against a fresh database, before the first migration: the grant
migrations reference the roles, so migrating a database that has never been bootstrapped fails.
It is idempotent, and it sets the passwords every time, so re-running it is also how a password
change in `.env` reaches the database.

Schema and migrations are managed with Drizzle in `packages/db`:

```sh
pnpm db:generate              # generate a migration from the schema
pnpm db:migrate               # apply pending migrations
pnpm db:import-core-data      # load required core data (topics) — idempotent, any environment
pnpm db:seed-dummy-data       # replace dummy data with the committed seed and rebuild read models
pnpm db:rebuild-read-models   # rebuild the derived cache tables from canonical data
pnpm db:reset                 # drop all schema objects so db:migrate rebuilds from empty
pnpm db:studio                # browse the database
```

The schema implements the bridge/registry canonical model ratified in ADR023: governed
registries for dimension types and values, observations linked to dimension values through
bridge records, and three derived read-model tables rebuilt from canonical data. Surrogate
keys are UUIDv7 (native `uuidv7()` default in PostgreSQL 18); the public Fingertips
indicator number survives as `indicator.fingertips_id`. Grants are explicit and read-only:
`public_api` sees the published surface (not `upload_batch`), `internal_api` additionally
sees upload state, and a table added by a future migration gets no access until granted
deliberately. Write grants wait for the publisher workflow design.

The package layout, naming conventions, the add-a-table checklist and the core data
import's semantics are documented in [`packages/db/README.md`](packages/db/README.md).

A fresh database is ready for development with:

```sh
pnpm services:up && pnpm db:bootstrap && pnpm db:migrate && pnpm db:import-core-data && pnpm db:seed-dummy-data
```

The dev scripts start the database but deliberately do not migrate it: applying migrations is not
something that should happen as a side effect of running the apps. So a first run — or any run after
`docker compose down -v` — needs the command above before the pages have data.

The seed is real Pholio data for 13 indicators and the prototype's geography catalogue,
committed as gzipped CSVs — see `packages/db/data/seed/README.md` for what is in it and
how to regenerate it.

## Graceful shutdown

On SIGTERM or SIGINT every server drains, closes, then cleans up — releasing the database pool, and
Vite in dev. `SHUTDOWN_GRACE_PERIOD_MS` (default 25s) is the budget for all three rather than a
timeout per phase, so it is directly comparable to Container Apps' `terminationGracePeriodSeconds`
and must stay under it, since that is what decides when SIGKILL arrives. It is a ceiling and not a
wait: a stop with nothing in flight is immediate. `SHUTDOWN_DRAIN_MS` is how long the server goes on
serving while readiness fails, giving the ingress time to stop routing here; it comes out of the
budget rather than adding to it, and is zero locally, five seconds elsewhere.

All four apps serve the same two probes, so one configuration covers every app: `/livez` stays 200
throughout a stop, `/readyz` answers 503 with `"status": "draining"` from the moment a signal
arrives.

## Operational commands

`apps/operations` is a command-line application for work done *to* a deployed environment rather
than by it. The `pnpm db:*` scripts above cover a developer machine, where the database is a
container on localhost and drizzle-kit is installed; neither is true of a managed server, which has
no public endpoint and can only be reached from inside its network. This is what runs there, as a
job:

```sh
pnpm --filter @fphd/operations cli db bootstrap             # create the per-API login roles
pnpm --filter @fphd/operations cli db migrate               # apply pending migrations
pnpm --filter @fphd/operations cli db status                # report migration state; non-zero if blocked
pnpm --filter @fphd/operations cli db import-core-data      # load required core data (topics)
pnpm --filter @fphd/operations cli db seed-dummy-data       # replace all dummy data with the seed
pnpm --filter @fphd/operations cli db rebuild-read-models
pnpm --filter @fphd/operations cli db reset                 # dev-class only: drop all schema objects
```

The `pnpm db:*` root scripts for these are thin wrappers over the same commands, so local and
deployed run one engine. A first run — local or deployed — is `bootstrap` → `migrate` →
`import-core-data` → `seed-dummy-data`; a dev-only rebuild from empty is `reset` → `migrate` →
`import-core-data` → `seed-dummy-data`.

Deployed, the same commands are `node dist/cli.js db migrate` and so on, in the `operations` image.
That image also carries `psql`, because a database with no public endpoint makes a container inside
the network the only route to an ad-hoc query. It is version 18, matching the server — `pg_dump`
refuses to run against a server newer than itself.

Four commands are worth noting:

- `db bootstrap` is the only bootstrap path: the local compose database (via `pnpm db:bootstrap`),
  CI's integration job and a managed server all create the per-API roles through it. It is
  idempotent — safe against a server where the roles already exist — and it sets the passwords
  every time, so it is also how a credential is rotated.
- `db import-core-data` loads the required starting data the service relies on — today that is
  topics, from `packages/db/data/topics.json`. It is idempotent (upserts keyed on stable ids,
  rows absent from the file are reported rather than deleted) and runs in any environment: this
  is permanent content preview and production need, not dummy data.
- `db seed-dummy-data` replaces the dummy data — the committed indicators, observations and the
  links tying those indicators to topics — and rebuilds the read models, in one command and one
  transaction. A job runs one command, and a seeded database whose read models are still empty
  serves an empty site. It refuses to run unless `APP_ENV` is `local`, `test` or `dev`, and fails
  if topics have not been imported yet: dummy data may depend on core data, never the reverse. The
  core-data tables are left alone.
- `db reset` drops all application schema objects (tables, types, the migration watermark) so
  `db migrate` rebuilds from empty — drop rather than truncate, so it also recovers from a broken
  migration state. It refuses outside `local`/`test`/`dev` and never touches database roles.

`db bootstrap` needs `PUBLIC_API_PASSWORD` and `INTERNAL_API_PASSWORD`; the other commands do not,
and fail naming them rather than requiring every job to hold role passwords. All of them connect as
the owner role (`POSTGRES_USER`/`POSTGRES_PASSWORD`), not as a per-API role.

### Invoking them from a deployed environment

Deployment lives in the infrastructure repository, which owns the jobs that call these. Command
`node dist/cli.js <command>`:

```sh
db bootstrap             # additionally needs PUBLIC_API_PASSWORD and INTERNAL_API_PASSWORD
db migrate
db status
db import-core-data
db seed-dummy-data
db rebuild-read-models
db reset
```

Required environment, for every command:

```sh
APP_ENV                  # dev | preview | production for a deployed job; no default, so an
                         # unset value fails the job rather than relaxing TLS in silence
DB_HOST
POSTGRES_DB
POSTGRES_USER            # the owner role, not a per-API role
POSTGRES_PASSWORD
```

`DB_PORT`, `DB_TLS` and `LOG_LEVEL` are optional. Exit codes: `0` success, `1` failure, `2`
unrecognised command.

## Container images

`docker/Dockerfile` builds the production images — one per deployable application, plus
`operations`. A shared builder stage installs the workspace and builds the requested app; then
`--target` picks the runtime shape and `--build-arg APP` picks the app:

```sh
docker build -f docker/Dockerfile --target web --build-arg APP=public-web   -t public-web   .
docker build -f docker/Dockerfile --target web --build-arg APP=internal-web -t internal-web .
docker build -f docker/Dockerfile --target api --build-arg APP=public-api   -t public-api   .
docker build -f docker/Dockerfile --target api --build-arg APP=internal-api -t internal-api .
docker build -f docker/Dockerfile --target operations --build-arg APP=operations -t operations .
```

Five images, three targets. The two web apps have identical runtime stages — same base, same
init, same start command — and so do the two APIs; only *which* app the builder compiled into
the image differs. A per-app target would be a copy with nothing changed in it, so the targets
split only where the runtime genuinely does: `dist/server.js` for an API, `server.ts` for a web
app, and the CLI-plus-`psql` image for operations.

`pnpm deploy --prod --legacy` prunes devDependencies and copies only the workspace packages the app
actually depends on, so no image carries pnpm, TypeScript, drizzle-kit or another app's code.
`--legacy` is required because the current implementation expects injected workspace packages, which
this workspace does not use. Images run as the `node` user and start under tini, which guarantees
SIGTERM is delivered to a process running as PID 1 — the kernel discards a default-action signal
sent to PID 1 unless that process installed a handler. Every server stops gracefully on that
signal, well inside a thirty-second grace period. `HOST` and `PORT` come from the environment,
defaulting to `0.0.0.0` and the app's own port.

This is separate from `docker/app.Dockerfile`, which is the development image used by
[mixed local/Docker development](#mixed-localdocker-development) and keeps the whole workspace and
its devDependencies — exactly what the production images must not do.

`.github/workflows/publish-images.yml` builds all five on every push to `main` and pushes them to
Azure Container Registry, tagged with the commit SHA and `latest`. OCI labels carry the repository,
commit and build time rather than encoding them in the tag. There is no registry password and no
service-principal secret: the workflow mints a GitHub OIDC token, `azure/login` exchanges it for an
Azure token under a federated credential that trusts only main-branch runs of this workflow, and the
identity behind it holds `AcrPush` alone. It needs three repository secrets — `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`.

**Deploy by digest, not by tag.** Both tags are labels for people; neither is a stable reference to
particular bits. ACR tags are mutable, and re-running the workflow for a commit already published
necessarily builds a different manifest — the `created` label alone guarantees it — which then
overwrites both tags. A replica scaling up afterwards against the same tag can get different code
from the one already running. Each run therefore prints the pushed digest to its summary:

```
fphdbetaacr.azurecr.io/public-web@sha256:4f30b957…
```

That is what a revision should reference, and what `app_images` in the infrastructure repository
should be set to. Deploys are manual for now, so the summary is where to copy it from.

Trivy scans each image between building and pushing, and a fixable high or critical vulnerability
in an operating system package stops it reaching the registry. That layer is otherwise unscanned —
CodeQL reads the source and CI's audit job resolves the npm tree from the lockfile, and neither
looks at the Alpine packages underneath, which is also why the scan covers OS packages only. The
base image is pinned by digest and raised by Dependabot, and the runtime stage runs `apk upgrade`,
so a red scan means a fix apk could not deliver rather than a stale pin. The pin names its Alpine
release (`24-alpine3.24`) rather than using the floating `24-alpine` alias, so a Dependabot digest
bump cannot move the base to a new Alpine release — and everything the operations image installs
by name — without anyone choosing to.

## Mixed local/Docker development

Any subset of the four applications can run as Docker containers while the rest run locally.
`pnpm dev:mixed` takes the apps to run **locally** and starts everything else (plus the database) as
containers:

```sh
pnpm dev:mixed internal-api                 # internal-api local; other three in containers
pnpm dev:mixed internal-web internal-api    # internal pair local; public pair in containers
pnpm dev:mixed public-web internal-web      # both webs local; both APIs in containers
```

The script behind it is `scripts/dev.sh`, which can be run directly with the same arguments.

Ctrl-C stops the local apps and the app containers; the database stays up. Running all four locally
is just `pnpm dev`.

Each app service in `compose.yaml` sits behind a profile of the same name, so plain
`docker compose up` still starts only the database. The containers are built by
`docker/app.Dockerfile` from the current working tree and run the app's **production build**
(`pnpm build` output via `pnpm start`) — no file watching, no bind mounts. They are rebuilt each
time the script starts (cheap when nothing changed, thanks to layer caching), so a container picks
up source changes on the next start, not live.

Every app is reachable on the host at its canonical port (3000/3001/4000/4001) whether local or
containerised, because containers publish those ports. Any URL by which one app reaches another
must be env-driven with a localhost default; a containerised app overrides it with
`host.docker.internal:<port>`, which reaches whatever runs behind that port on the host — local
process or published container alike. This one rule is what makes every combination work without
per-combination configuration. (The APIs' database connection is the exception: containerised APIs
reach Postgres directly over the compose network via `DB_HOST=db`.)

## Structure

`apps/*` hold deployment wiring, routes and entrypoints, and never import one another — reusable
business and feature logic belongs in `packages/*`. `tools/*` holds workspace members that support
the build rather than ship in it. `apps/operations` is the exception: an application like the other
four, but it serves no traffic — see [Operational commands](#operational-commands).
