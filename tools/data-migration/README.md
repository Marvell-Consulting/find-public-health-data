# Live data migration

This tool builds the one-time Fingertips baseline and the ordered increments used while
publishing moves to this service. The operations image applies the packages with
`db migrate-live-data`.

## Prerequisites

- Install the repository's Node and pnpm versions and run `pnpm install`.
- Use a read-only `PHOLIO_CONNECTION_STRING` (SQL Server connection string) pointing at the
  benchmark VM's Pholio copy for development exports, or at DHSC's SQL Managed Instance for
  production exports. Set `--expected-database` to the restored database's name.
- Keep source exports, prepared snapshots and archives in private storage outside the
  repository. The archive command also requires `tar` on the host.

## Safety and provenance

- `export-pholio` reads the source through separate requests. Export from an immutable
  restored backup so every table belongs to the same cut of the data.
- Production `export-pholio` requires `--approved-indicators`, a JSON file containing
  the positive integer IDs approved for launch, for example `[108, 241]`. Only those
  indicators and their observations are eligible for publication. Explicit exclusions
  can further narrow that list; a requested indicator missing from Pholio stops export.
  The source manifest records the selection, exported count and non-approved count.
- Observation pre-flight counts each intentional exclusion: non-approved indicators,
  explicit exclusions, test indicator 94204, placeholder note 506, empty sentinel rows
  and years before 1900. Unknown areas, notes, metadata and dimension values stop export
  with source-row diagnostics. There is no implicit future-period exclusion: all eligible
  source observations for approved indicators are included.
- Area aliases prefer the non-n-prefixed code deterministically. Both source aliases map
  to the survivor, so their observations and relationships retain the same area identity.
- Every migrated timestamp is the indicator's `DateEnteredInPHOLIO`, never the export time,
  so re-exporting unchanged source data writes the same rows and an increment carries only
  real changes. The export time appears only in the manifest.
- The expected live database name must match `DB_NAME()`.
- UUIDs are deterministic from the source table and integer ID. The same source row keeps
  the same target ID across the baseline and every increment.
- Each package names its schema format, source snapshot time, predecessor, row counts and
  SHA-256 digest for every file. The archive has a separate SHA-256 digest.
- An increment carries `ci_method`, `comparator_method` and `numerator_denominator_source` in
  full: the importer maps versions through them by name and stores none of their rows.
  When any reference list changes, the increment resends all remaining versions so their
  core methods and provider links are resolved again. Version files require both legacy source columns. Batches identify their owning version; versions point at their batch, and observation keys carry sorted dimension-value UUIDs. The receiver resolves the version/batch cycle inside its import transaction.
- Deleting a version also deletes the topic, classification and source rows the migration
  wrote for it. A version a publisher has added links or age ranges to is never deleted;
  the import stops and names the count.
- Financial cumulative-quarter data retains its cumulative date ranges; quarter numbers are never treated as distribution ranks. Repeated canonical observation keys stop the export with source-row diagnostics.
- The importer resumes an interrupted package download from the bytes it already has.
- A baseline only applies when every canonical target table and the migration ledger are
  empty. An increment only applies after its named predecessor, with a later cutoff.
- The importer takes an advisory lock and applies canonical rows, reviewed relationships,
  read models and the ledger record in one transaction. Reapplying the same package is an
  idempotent no-op; reusing its ID for different bytes fails.
- Topic and classification assignments must be supplied as a separately reviewed file.
  The demo profile heuristic is never accepted implicitly.

## Reviewed relationship file

The prepare step requires JSON accepted by the existing indicator relationship schema,
plus these fields:

```json
{
  "approval": {
    "approvedBy": "person or governance group",
    "approvedAt": "2026-09-22T12:00:00Z",
    "basis": "Reference to the reviewed mapping"
  },
  "indicators": [108, 241],
  "indicatorTopics": [],
  "indicatorDataUpdatedAt": {},
  "classifications": [],
  "indicatorClassifications": []
}
```

`indicators` must exactly match the indicators in the package, and each must have at least
one topic assignment. Preparation checks topic coverage before writing prepared output;
the importer verifies the applied links before committing.

## Export pre-flight checks

Before writing any file, `export-pholio` runs a slug check that cannot be retried cheaply
after a 29-million-row export:

- **Slug collisions**: no two exported indicator names may slugify to the same slug, since
  a slug belongs to exactly one indicator. The check names every colliding pair (source id
  and name) so the editorial problem can be resolved in the source — by renaming or
  excluding one of the pair — before exporting again.

## Excluding indicators

Pass `--excluded-indicators` as a JSON array to omit specific approved indicators and
their observations, upload batches and bridge data from the export. The source manifest
records `excluded_indicators` and `excluded_observations` so the result is auditable.

```sh
# Exclude a pair of indicators that share a name (and therefore a slug):
pnpm --filter @fphd/data-migration data-migration export-pholio \
  --expected-database pholio_live_b \
  --approved-indicators /secure/approved-indicator-ids.json \
  --out-dir /secure/fphd-snapshot-001 \
  --excluded-indicators '[90366, 93283]'
```

The specific ids to use in production are a human decision documented alongside the
reviewed relationships file. Do not hardcode them here.

## Build the baseline

Keep source credentials in the environment rather than a command argument.

```sh
export PHOLIO_CONNECTION_STRING='Server=…;Database=pholio_live_b;…'
pnpm --filter @fphd/data-migration data-migration export-pholio \
  --expected-database pholio_live_b \
  --approved-indicators /secure/approved-indicator-ids.json \
  --out-dir /secure/fphd-snapshot-001

pnpm --filter @fphd/data-migration data-migration prepare-baseline \
  --directory /secure/fphd-snapshot-001 \
  --migration-id baseline-2026-09-22 \
  --relationships /secure/approved-indicator-relationships.json \
  --out-dir /secure/fphd-prepared-001

pnpm --filter @fphd/data-migration data-migration archive \
  --directory /secure/fphd-prepared-001 \
  --output /secure/baseline-2026-09-22.tar
```

Upload the archive to private migration storage. Pass a short-lived HTTPS URL and the
digest from the generated `.sha256` file to the operations job as
`DATA_MIGRATION_URL` and `DATA_MIGRATION_SHA256`.

Preparation never changes the source export. It tidies names, refuses ambiguous reference
name collisions and rekeys a staged copy, then renames the complete package into the new
output directory. Existing output is refused; a failed attempt removes its partial output,
so the same source can be retried or prepared under a different migration ID.

## Build transition increments

Export and prepare a new full snapshot with a new migration ID. Diff it against the full
snapshot used for the preceding package:

```sh
pnpm --filter @fphd/data-migration data-migration create-incremental \
  --previous /secure/fphd-prepared-001 \
  --current /secure/fphd-prepared-002 \
  --out-dir /secure/fphd-increment-002 \
  --migration-id increment-2026-09-23
```

The output must be a new directory. Increment preparation rejects existing paths, including
symlink aliases of either input, and stages the complete package before publishing it.
Failures remove the staged output and leave both full snapshots intact.

Archive and apply that output in the same way as the baseline. Retain each prepared full
snapshot until the next increment has been built. Comparing complete ordered snapshots
captures inserts, corrections and deletions without relying on source update timestamps.

## Apply and verify

Run schema migrations and core topic import before the first live data package:

```sh
pnpm db:migrate
pnpm db:import-core-data
DATA_MIGRATION_URL='https://…' DATA_MIGRATION_SHA256='…' pnpm db:migrate-live-data
```

The command logs the migration ID, package kind and per-table upsert and delete counts.
Verify the `data_migration` ledger, canonical counts, four read-model counts, search and a
representative indicator before directing traffic to the database.

## Test and structure

Run `pnpm vitest run --project @fphd/data-migration` and
`pnpm --filter @fphd/data-migration typecheck` from the repository root.

- `export-pholio.ts` reads Pholio (SQL Server) and writes the source export that both
  `prepare-baseline` and `export-dev-snapshot` take as input.
- `prepare-baseline.ts` verifies, normalises and deterministically rekeys that cut.
- `diff.ts` creates an ordered incremental package from two prepared full snapshots.
- `archive.ts` verifies package files before creating the private transport archive.
- `export-dev-snapshot.ts` produces a `verifyPublishedSnapshot`-compatible archive from
  Pholio for developer imports (see below).
- `legacy-seed.ts`, `prototype-seed.ts` and `demo-topics.ts` retain the former local and
  demo maintenance workflows in TypeScript; production package construction does not call
  them.

## Build a dev snapshot from Pholio

`export-dev-snapshot` reads Pholio directly (currently via the benchmark VM's copy;
production via DHSC's SQL Managed Instance) and writes a `snapshot.tar` compatible with
`db import-published-snapshot`. It translates polarity, frequency and notes-and-caveats
into their service forms and rekeys every integer id to a deterministic UUIDv7. After export,
it checks the B fingerprint: 1,329 indicators and 29,656,329 observations before the four
explicit exclusions. These counts omit test indicator 94204. The archive records
`PHOLIO_LIVE_B export` and source database `pholio_live_b`.

```sh
export PHOLIO_CONNECTION_STRING='Server=…;Database=pholio_live_b;…'
pnpm --filter @fphd/data-migration data-migration export-dev-snapshot \
  --out-dir /secure/fphd-dev-snapshot
```

Four source indicators (90366, 90776, 92774, 93280) are excluded because they share a
name with a newer indicator; the importer refuses an archive built with a different list.
The snapshot is not for production use; update it from Pholio when more recent content
is required.
