# @fphd/db

Drizzle ORM schema, migrations, repository functions and database tooling shared by the
API apps. Each API connects with its own login role (`public_api` / `internal_api`) via
`createDb`. Everything that writes — migrations, the seed, the read-model rebuild, the
import tooling and the test harness — connects as the owner login (`POSTGRES_USER`) via
`createOwnerClient`.

Migrations then set their role to `fphd_owner`, a NOLOGIN group that owns every migrated
object, so the identity running DDL can be replaced without splitting the schema across two
owners. `bootstrapOwnerRole` creates it and must run once against each database before
anything migrates; `operations db bootstrap` and the compose initdb script both do that,
and it is safe to re-run against a database that predates the group.

## Layout

```
data/                 Import files (topics.json) and the committed seed (seed/)
drizzle/              Generated migrations + drizzle-kit metadata — never edit applied ones
src/
  schema/             One file per domain group, re-exported by schema/index.ts: lookup.ts
                      holds the reference tables, observation.ts the observation family,
                      cache.ts the derived read models
    helpers.ts        Column helpers shared across tables (uuidPrimaryKey, timestamps, audit)
  scripts/            CLI entrypoints and their script-only helpers — the package.json
                      scripts are the run surface; anything reusable lives outside
  client.ts           createDb + Database/Schema types
  env.ts              dbEnvFields — shared connection env fragment
  read-models.ts      rebuildReadModels — repopulates the cache.ts tables from canonical data
  seeding.ts          Loads data/seed into an empty database
  testing.ts          Integration-test database harness (@fphd/db/testing)
  schema.ts           Barrel re-exporting schema/index.ts; what drizzle.config.ts reads
  *-repository.ts     Query functions per aggregate: pure, take `db` as first argument
  index.ts            Package surface
```

## Conventions

- **Tables**: singular `snake_case` names (`indicator`, `observation`, `topic`), and so
  are columns. A junction table joins the two singular names — `observation_dimension`,
  `area_relationship`. Write camelCase property names in schema files; `casing:
  'snake_case'` maps them.
- **Ids**: UUIDv7 via `uuidPrimaryKey()` from `schema/helpers.ts`, which defaults to
  Postgres 18's native `uuidv7()`. Rows created by an import supply their own ids
  instead, so the id survives a re-import. The read models in `cache.ts` are the
  exception: they are keyed by the columns they aggregate and carry no surrogate id.
- **Timestamps**: opt-in, not universal. Spread `timestamps` from `schema/helpers.ts`
  (`created_at` / `updated_at`, timestamptz) on a table whose rows are updated in place,
  as `topic` does, or `audit` where the actor columns matter too, as `indicator` does.
  `observation` records only creation, since a correction supersedes a row rather than
  editing it. Reference tables carry neither. `updated_at` is app-maintained on writes;
  see the topics import's conditional upsert for the pattern.
- **Repository functions**: pure, `db` first argument, one file per aggregate.

## Adding a table

1. Add the table to the `src/schema/` file for its domain, or create one and re-export it
   from `src/schema/index.ts`.
2. `pnpm db:generate --name=create-<table>` (from the repo root; always pass a
   meaningful `--name`).
3. Grants are explicit and per-table — the API roles can read exactly what they have
   been granted, nothing implicitly. Add a custom migration:
   `pnpm --filter @fphd/db exec drizzle-kit generate --custom --name=<table>-grants`
   with the `GRANT` statements the roles need.
4. `pnpm db:migrate`.
5. Add repository functions and tests, including an integration assertion that the
   granted role can do what it needs and no more.

## Topics import

```sh
pnpm db:import-topics            # imports data/topics.json
pnpm db:import-topics -- <path>  # or another file
```

Upserts matched on `id`: a rename — even one that changes the slug — updates the row in
place without changing the primary key. Rows in the database but absent from the file
are reported and left alone, never deleted. Re-runs are true no-ops (`updated_at`
untouched), so the import is safe to run repeatedly.

## Integration tests

`src/*.integration.test.ts` need the local docker database up (`docker compose up -d db`)
but never touch the shared `fphd` database. The root Vitest global setup builds a
migrated, seeded template once per run; each test file calls `createTestDatabase()` from
`@fphd/db/testing` for its own throwaway copy and drops it in `afterAll`.
