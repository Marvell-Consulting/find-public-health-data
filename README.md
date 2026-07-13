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
```

Each application builds to its own `dist` directory, giving CI and deployment tooling four
unambiguous artifacts.

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
