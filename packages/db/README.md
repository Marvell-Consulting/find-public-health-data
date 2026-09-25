# @fphd/db

Drizzle ORM schema, the client and the repository functions the API apps read through. Each
API connects with its own login role (`public_api` / `internal_api`) via `createDb`.
Everything that writes as the owner login (`POSTGRES_USER`) — migrations, the imports, the
seed, the read-model rebuild — lives in `@fphd/db-operations`, which only the operations
CLI and the test harness depend on, so none of it ships in the API images.

## Layout

```
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
  testing.ts          Per-file test databases and fake repositories (@fphd/db/testing)
  schema.ts           Barrel re-exporting schema/index.ts; what @fphd/db-operations'
                      drizzle.config.ts reads
  *-repository.ts     Query functions per aggregate: pure, take `db` as first argument
  index.ts            The read surface the APIs consume (@fphd/db)
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
  as `topic` does, or `audit` where the actor columns matter too, as `indicator_version`
  does.
  `observation` records only creation, since a correction supersedes a row rather than
  editing it. Reference tables carry neither. `updated_at` is app-maintained on writes;
  see the topics import's conditional upsert for the pattern.
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
version's columns. `published.indicator`
carries that version's `slug` as the indicator's canonical address, while
`published.indicator_slug` lists every slug any published version carries, so an address a later
publication replaced still resolves. The definitions are hand-written in the migration;
`src/schema/published.ts` declares them with `pgSchema('published').view(...).existing()`
so drizzle-kit gives the repositories typed columns without generating a second
`CREATE VIEW`. Exports are prefixed (`publishedIndicator`) because the table names are
taken. `@fphd/internal-api-features` reads the tables directly, every status.

## Adding a table

1. Add the table to the `src/schema/` file for its domain, or create one and re-export it
   from `src/schema/index.ts`.
2. `pnpm db:generate --name=create-<table>` (from the repo root; always pass a
   meaningful `--name`). The migration lands in `@fphd/db-operations`.
3. Grants are explicit and per-table — the API roles can read exactly what they have
   been granted, nothing implicitly. Add a custom migration:
   `pnpm --filter @fphd/db-operations exec drizzle-kit generate --custom --name=<table>-grants`
   with the `GRANT` statements the roles need.
4. If the public site reads the table, that same custom migration adds a
   `published.<table>` view carrying the predicates that keep unpublished rows out, and
   grants `SELECT` on the view to `public_api` and `internal_api` — never on the table.
   Declare the view in `src/schema/published.ts` as `.existing()`. The grants integration
   test fails a table in `public` that `public_api` can reach.
5. `pnpm db:migrate`.
6. Add repository functions and tests, including an integration assertion that the
   granted role can do what it needs and no more.

## Integration tests

`src/*.integration.test.ts` need the local docker database up (`docker compose up -d db`)
but never touch the shared `fphd` database. The root Vitest global setup builds a
migrated, seeded template once per run through `@fphd/db-operations/testing`; each test
file calls `createTestDatabase()` from `@fphd/db/testing` for its own throwaway copy and
drops it in `afterAll`.
