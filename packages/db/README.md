# @fphd/db

Drizzle ORM schema, migrations, repository functions and database tooling shared by the
API apps. Each API connects with its own login role (`public_api` / `internal_api`) via
`createDb`; migrations and the import tooling run as the owner role (`POSTGRES_USER`).

## Layout

```
data/                 Seed/import files (e.g. topics.json, seed/)
drizzle/              Generated migrations + drizzle-kit metadata — never edit applied ones
src/
  schema/             One file per table, re-exported by schema/index.ts
    helpers.ts        Column helpers shared across tables (uuidPrimaryKey, timestamps, audit)
  scripts/            CLI entrypoints and their script-only helpers — the package.json
                      scripts are the run surface; anything reusable lives outside
  client.ts           createDb + Database/Schema types
  env.ts              dbEnvFields — shared connection env fragment
  testing.ts          Integration-test database harness (@fphd/db/testing)
  *-repository.ts     Query functions per aggregate: pure, take `db` as first argument
  index.ts            Package surface
```

## Conventions

- **Tables**: plural `snake_case` names (`topics`); columns singular. A future junction
  table is `<singular>_<plural>` (e.g. `indicator_topics`). Write camelCase property
  names in schema files — `casing: 'snake_case'` maps them.
- **Ids**: UUIDv7 via `uuidPrimaryKey()` from `schema/helpers.ts`, which defaults to
  Postgres 18's native `uuidv7()`. Rows created by an import supply their own ids
  instead, so the id survives a re-import.
- **Timestamps**: every table spreads `timestamps` from `schema/helpers.ts`
  (`created_at` / `updated_at`, timestamptz), or `audit` where the actor columns are
  wanted too. `updated_at` is app-maintained on writes; see the topics import's
  conditional upsert for the pattern.
- **Repository functions**: pure, `db` first argument, one file per aggregate.

## Adding a table

1. Create `src/schema/<table>.ts` and re-export it from `src/schema/index.ts`.
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
