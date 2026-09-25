# @fphd/db-operations

Everything only the operations CLI and the test harness do to a database: bootstrap,
migrate, import core data, seed, reset and rebuild the read models, along with the
migrations and data files they read. The API apps do not depend on it, so their images
carry none of it. The schema, client and repositories are in `@fphd/db`.

These connect as the owner login (`POSTGRES_USER`), through the operations CLI's config
for the root `db:*` commands, drizzle-kit's own config for `db:generate`/`db:studio` and
`createOwnerClient` from `@fphd/db/testing` for the test harness. The per-API roles are
created by `bootstrapRoles` (`pnpm db:bootstrap` locally, `operations db bootstrap`
deployed), which must run against a fresh server before the first migration: the grant
migrations reference the roles.

## Layout

```
data/                 Core content (topics.json, ci-methods.json), the dummy indicator
                      relationship files and the committed seed (seed/)
drizzle/              Generated migrations + drizzle-kit metadata — never edit applied ones
drizzle.config.ts     Reads the schema from ../db/src/schema.ts
src/
  bootstrap.ts        bootstrapRoles — the per-API login roles
  migrations.ts       migrateToLatest, and migration-status.ts to compare local and applied
  core-data.ts        importCoreData — loads the required core content (topics, CI methods)
  topic-import.ts     upsertTopics, the topics half of the core data import
  indicator-topic-import.ts
                      applyIndicatorTopics — the indicator relationship files
  seeding.ts          seedDummyTables — loads data/seed and the indicator relationships
  read-models.ts      rebuildReadModels — repopulates the cache tables from canonical data
  reset.ts            resetDatabase — drops all application schema objects
  testing.ts          Builds the integration tier's template databases
                      (@fphd/db-operations/testing)
  index.ts            The package entry (@fphd/db-operations)
```

## Core data import

```sh
pnpm db:import-core-data         # imports data/topics.json and data/ci-methods.json
```

Upserts matched on `id`: a rename — even one that changes the slug — updates the row in
place without changing the primary key. Rows in the database but absent from the file
are reported and left alone, never deleted. Re-runs are true no-ops (`updated_at`
untouched), so the import is safe to run repeatedly, in any environment.

Lookups a publisher chooses from are core data under the service's own names, with fixed
ids, so every environment holds the same rows; `ci-methods.json` is the first. The seed
and the published snapshot still carry Pholio's `ci_method.csv.gz`, but neither loads it:
`seeding.ts` reads it only to point each version at the core method of the same name,
through a short map of the names Pholio spells differently, and stops at a method with no
core counterpart.

The data-loading commands (`db:import-core-data`, `db:seed-dummy-data`, `db:reset`) all
run through `apps/operations`, so a developer machine and a deployed job use one engine —
see the operations section of the root README.

## Prerequisites

The workspace setup in the root `README.md`.
