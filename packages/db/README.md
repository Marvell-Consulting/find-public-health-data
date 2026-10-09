# @fphd/db

Drizzle ORM schema, migrations, repository functions and database tooling shared by the
API apps. Each API connects with its own login role (`public_api` / `internal_api`) via
`createDb`. Everything that writes — migrations, the imports, the seed, the read-model
rebuild — connects as the owner login (`POSTGRES_USER`), through the operations CLI's
config for the root `db:*` commands, drizzle-kit's own config for `db:generate`/`db:studio`
and `createOwnerClient` for the test harness. The per-API roles are created by
`bootstrapRoles` (`pnpm db:bootstrap`
locally, `operations db bootstrap` deployed), which must run against a fresh server before
the first migration: the grant migrations reference the roles.

## Layout

```
data/                 Core content (topics.json, ci-methods.json, classifications.json,
                      data-providers.json, value-types.json, units.json,
                      comparator-methods.json), the map from Fingertips' numerator and
                      denominator sources onto it, the dummy indicator relationship files
                      and the committed seed (seed/)
drizzle/              Generated migrations + drizzle-kit metadata — never edit applied ones
src/
  schema/             One file per domain group, re-exported by schema/index.ts: lookup.ts
                      holds the reference tables, observation.ts the observation family,
                      cache.ts the derived read models
    helpers.ts        Column helpers shared across tables (uuidPrimaryKey, timestamps, audit)
    published.ts      The public read surface: views declared as already existing
  scripts/            owner-client.ts — the owner-role connection helper the test harness
                      uses; the runnable commands live in apps/operations
  client.ts           createDb + Database/Schema types
  env.ts              dbEnvFields — shared connection env fragment
  dimension-key.ts    dimensionKey — an observation's dimension_key from its dimension values
  read-models.ts      rebuildReadModels — repopulates the cache.ts tables from the published views
  core-data.ts        importCoreData — loads the required core content (topics, CI methods,
                      classifications, data providers, value types, units, comparator
                      methods)
  legacy-sources.ts   Maps Fingertips' numerator and denominator sources onto the providers
  seeding.ts          seedDummyTables — loads data/seed and the indicator relationships
  reset.ts            resetDatabase — drops all application schema objects
  testing.ts          Integration-test database harness (@fphd/db/testing)
  schema.ts           Barrel re-exporting schema/index.ts; what drizzle.config.ts reads
  *-repository.ts     Query functions per aggregate: pure, take `db` as first argument
  index.ts            The read surface the APIs consume (@fphd/db)
  operations.ts       Bootstrap, migrate, import, seed, reset and rebuild (@fphd/db/operations),
                      consumed only by apps/operations and the test harness
```

## Conventions

- **Tables**: singular `snake_case` names (`indicator`, `observation`, `topic`), and so
  are columns. A junction table joins the two singular names — `observation_dimension`,
  `area_relationship`. Write camelCase property names in schema files; `casing:
  'snake_case'` maps them.
- **Child tables**: a table of a version's rows is `indicator_version_<child>`
  (`indicator_version_link`, `indicator_version_topic`), with `indicator_version_id` first in
  its primary key. Its foreign keys are named explicitly, `<table>_<target>_fk` as in
  `indicator_version_source_source_fk`, because a generated name longer than Postgres's 63
  bytes is silently cut short.
- **Ids**: UUIDv7 via `uuidPrimaryKey()` from `schema/helpers.ts`, which defaults to
  Postgres 18's native `uuidv7()`. Rows created by an import supply their own ids
  instead, so the id survives a re-import. The read models in `cache.ts` are the
  exception: they are keyed by the columns they aggregate and carry no surrogate id.
- **Timestamps**: every core data table (the topics, the classifications and the lists a
  publisher chooses from) spreads `timestamps` from `schema/helpers.ts` (`created_at` /
  `updated_at`, timestamptz). `updated_at` is app-maintained: the import's conditional upsert
  bumps it only on a row the file changes, as the topics import shows. A table a publisher
  edits spreads `audit` where the actor columns matter too, as `indicator_version` does. A
  version's child tables carry neither: their rows are deleted and reinserted on every save,
  and the version's own `updated_at` records that. `observation` records only creation,
  since a correction supersedes a row rather than editing it.
- **Vocabularies**: a closed set whose values the code behaves on is a checked text column,
  `text({ enum })` beside a check written with `literals()` over the list in its
  `@fphd/utils` module, which also holds the labels and which the contracts and pages import,
  as `polarity`, `period_type` and `year_type` do. An open list a publisher chooses from is
  core data (below), and no new migration inserts its rows.
- **Yes/no answers and details**: a yes/no answer is `has_<subject>`, always positive, the
  text beside it `<subject>_detail`, and the text beside an "other" choice
  `<question>_detail` (`calculated_by_detail`, `unit_detail`). The checks mirror the contract:
  a detail it requires beside a yes is held there and nowhere else,
  `(has_x IS TRUE) = (x_detail IS NOT NULL)`; an optional one is only refused elsewhere,
  `has_x IS TRUE OR x_detail IS NULL`. `goal_policy_detail`, the optional detail beside
  `has_goal_benchmark`, is the one whose name predates the rule.
- **Text length**: how long an answer may be, and which characters it may hold, is the
  contract's rule, applied at the form and the API; no check measures a publisher's text.
  The slug's length is part of its format, so its check keeps it.
- **Observation keys**: `observation.dimension_key` is the row's dimension value ids sorted
  and joined, empty for a total; with the batch, area and dates it is the row's natural key,
  held unique by an index. Whatever inserts an observation writes it, from the dimension values
  it is about to bridge to: `dimensionKey` in TypeScript, or the `string_agg` it documents in
  SQL, as the seed load does.
- **Repository functions**: pure, `db` first argument, one file per aggregate.
- **Slugs**: `indicator_version.slug` is derived from the version's name by `slugify` in
  `@fphd/utils/slug`. An exclusion constraint,
  `EXCLUDE USING gist (slug WITH =, indicator_id WITH <>)`, keeps a slug to one indicator for
  ever: versions of one indicator share it, two indicators may not, and a draft holds its
  slug until it is deleted. A draft is re-slugged on rename only until the indicator is first
  published; from then on the slug is the public address and every version keeps it. Drizzle
  cannot express the constraint, so it lives in the migration alone.

## The `published` schema

`public_api` holds no privilege on any table in `public`. It reads the views in the
`published` schema and nothing else, so every predicate that hides an unpublished
indicator lives in a view definition rather than in each query — `@fphd/db`'s public
repositories select from the views, name for name. An indicator may hold several published
versions; `current_published_version`, a view in `public` declared in `src/schema/indicator.ts`,
is the one definition of which: the most recently published, ties broken by id. It selects only
the version's `id` and `indicator_id`, so a new `indicator_version` column never changes it or the
views built on it. The published views join it, and the internal reads join
`currentPublishedVersion` for the same rule, each then joining `indicator_version` by `id` for the
version's columns. Observations follow the current published version's batch: each version points at the
upload batch holding its data (`indicator_version.upload_batch_id`, shared by a later version
until it uploads its own), and `published.observation` shows the undeleted rows of the batch the
current published version points at, with `published.observation_dimension` and
`published.observation_note` following it. Publishing therefore switches an indicator's data
over in one step, and a draft's rows never show. The read-model rebuild reads the published
views, so the read models hold published data alone. `published.indicator`
carries that version's `slug` as the indicator's canonical address, while
`published.indicator_slug` lists every slug any published version carries, so an address a later
publication replaced still resolves. The definitions are hand-written in the migration;
`src/schema/published.ts` declares them with `pgSchema('published').view(...).existing()`
so drizzle-kit gives the repositories typed columns without generating a second
`CREATE VIEW`. Exports are prefixed (`publishedIndicator`) because the table names are
taken. `@fphd/internal-api-features` reads the tables directly, every status.

A migration that only appends columns to a view uses `CREATE OR REPLACE VIEW`, which keeps the
view and its grants. One that renames a column uses `ALTER VIEW ... RENAME COLUMN`; only one
that removes a column drops and recreates the view, and grants it again. The grants test's
"reads the same columns of each indicator view as it always has" case catches a view that
changed by accident.

## Adding a table

1. Add the table to the `src/schema/` file for its domain, or create one and re-export it
   from `src/schema/index.ts`.
2. `pnpm db:generate --name=create-<table>` (from the repo root; always pass a
   meaningful `--name`). drizzle-kit loads `@fphd/config` and `@fphd/utils` from their
   `dist`, so the root script builds them first; running drizzle-kit directly against a
   stale `dist` fails with a module-not-found error, or generates from old constants. For a
   rename drizzle-kit asks, in a terminal, whether a column is new or renamed.
3. Grants are explicit and per-table — the API roles can read exactly what they have
   been granted, nothing implicitly. Add a custom migration:
   `pnpm --filter @fphd/db exec drizzle-kit generate --custom --name=<table>-grants`
   with the `GRANT` statements the roles need.
4. If the public site reads the table, that same custom migration adds a
   `published.<table>` view carrying the predicates that keep unpublished rows out, and
   grants `SELECT` on the view to `public_api` and `internal_api` — never on the table.
   Declare the view in `src/schema/published.ts` as `.existing()`. The grants integration
   test fails a table in `public` that `public_api` can reach.
5. `pnpm db:migrate`.
6. Add repository functions and tests, including an integration assertion that the
   granted role can do what it needs and no more.

## Migrations

`pnpm check:migrations`, part of `pnpm check` and its own CI job, fails when the schema
differs from the latest snapshot in `drizzle/meta`, as it does when a schema change has no
migration. It runs drizzle-kit check for migrations that collide, then drizzle-kit generate
against a copy of `drizzle/`, refusing anything but "no schema changes". It compares the
schema with the snapshot, not with the migration SQL, so it cannot catch a hand-edited
migration that the snapshot does not match. It builds the two packages first, as
`db:generate` does.

A migration never edits an applied one. Until an environment holds publisher data the seed
cannot restore, a migration may drop data that a reset and reseed of the shared environments
restores, where that is cleaner than translating it; from then on every migration
translates. Either way, one that meets an answer it cannot translate stops with an error
rather than drop it, as 0034 and 0036 do.

## Core data import

```sh
pnpm db:import-core-data         # imports topics, classifications and the publisher's lists
```

Upserts matched on `id`: a rename — even one that changes the slug — updates the row in
place without changing the primary key. Rows in the database but absent from the file
are reported and left alone, never deleted. Re-runs are true no-ops (`updated_at`
untouched), so the import is safe to run repeatedly, in any environment.

Lookups a publisher chooses from are core data under the service's own names, with fixed
ids, so every environment holds the same rows and the seed's relationship files can name
them by id: the CI methods, data providers, value types, units and comparator methods. No
new migration inserts a row of any of them. The value type and unit rows migration 0035
inserted carry the ids the files hold, and 0037 re-keys each comparator method a database
already held to the id `comparator-methods.json` gives its name, deleting those the file
lacks and stopping if a version names one of them. `value-types.json` and `units.json` list
their rows in the order the publisher's form shows them, which the import stores as each
row's `position`; code that behaves differently for a row keys it on the row's fixed id,
kept as a constant in `@fphd/utils/value-type-and-unit`. The seed and the published
snapshot still carry Pholio's `ci_method.csv.gz` and `comparator_method.csv.gz`, but
neither loads them: `seeding.ts` reads them only to point each version at the core row of
the same name, through a short map of the CI method names Pholio spells differently, and
stops at a row with no core counterpart.

`data-providers.json` holds the providers a numerator's or denominator's data comes from,
each with its named sources; a publisher may also choose a provider with no specific source.
It is the prototype's list plus the providers and sources the Fingertips data names that the
prototype leaves out. The seed and the snapshot carry Pholio's flat
`numerator_denominator_source.csv.gz`, which is staged but not loaded:
`legacy-numerator-denominator-sources.json` maps each of its names to the providers and
sources it stands for, or to none (for "Not applicable"), and a name the map lacks, or a
pair the core data does not hold, stops the load.

The data-loading commands (`db:import-core-data`, `db:seed-dummy-data`, `db:reset`) all
run through `apps/operations`, so a developer machine and a deployed job use one engine —
see the operations section of the root README.

## Integration tests

`src/*.integration.test.ts` need the local docker database up (`docker compose up -d db`)
but never touch the shared `fphd` database. The root Vitest global setup builds a
migrated, seeded template once per run; each test file calls `createTestDatabase()` from
`@fphd/db/testing` for its own throwaway copy and drops it in `afterAll`.

A migration's own test puts rows in the shape the migration meets with `migrateBefore`, then
runs it with `migrateThrough`, which stops there, so a later migration never breaks it.
