# Seed data

Real Pholio data loaded as gzipped CSVs by `pnpm db:seed`. The original ten-indicator
snapshot came from the canonical bridge/registry migration; the three prototype showcase
additions come from the public Fingertips API and are imported through local Postgres.

## What is in it

Reference and registry tables (lookups, dimension types and values, area types, note
types) are complete. Areas, observations and bridge rows contain:

- **13 indicators**, combining broad schema coverage with the prototype's showcase data:

  | ID | Indicator | Why |
  |---|---|---|
  | 108 | Under 75 mortality rate from all causes | DSR; sex, age, deprivation deciles |
  | 241 | Diabetes: QOF prevalence | Prototype showcase; GP, NHS and local-authority trends from 2009/10 |
  | 40501 | Under 75 mortality rate from cancer | DSR; same shapes, second mortality series |
  | 90366 | Life expectancy at birth | Rate ratio; always sexed, deprivation trend deciles |
  | 90851 | % resident in each deprivation quintile | Proportion; IMD2010/2015 quintiles |
  | 92026 | Reception prevalence of obesity | Proportion; ethnicity (17 groups), deprivation quintiles |
  | 92033 | Year 6 prevalence of obesity | Proportion; pairs with 92026 for comparisons |
  | 92443 | Smoking prevalence in adults (current) | Proportion; 15+ dimension types incl. socioeconomic, tenure, religion, sexuality |
  | 92708 | Resident population | Count; sex × age-band population pyramids |
  | 93622 | Community mental health contacts | Deprivation quintile within area (IMD2019) |
  | 93861 | Mortality attributable to particulate air pollution | Prototype showcase; England, regional, NHS and local-authority trends |
  | 93995 | Mortality rate for deaths involving diabetes | Prototype showcase; annual and rolling trends from 2001 |
  | 94194 | Emergency admissions for gastroenteritis (0–4) | Crude rate; deprivation deciles |

- **6,544 current areas**: England, 9 statistical regions, current local authorities,
  6,168 GP practices, 42 integrated care boards and 7 NHS regions.
- The original ten indicators retain their existing focused date window. The prototype
  additions include their full published trend for the geographies above.

That yields 489,998 observations, 758,989 bridge rows and 74,755 observation notes.

## Semantics worth knowing

- An observation's aggregate ("Persons, all ages") is expressed by the **absence** of a
  dimension bridge row, not by aggregate-flagged dimension values. Some indicators have
  no fully-aggregate observations at all (life expectancy is always sexed), so
  `latest_headline` — which follows the alpha benchmark's definition of headline =
  observation with zero bridge rows — only has rows for 92708 and 93622. Refining
  headline semantics is ISS106 read-model design work.
- `indicator.config` was converted from Pholio's `key:value,key:value` text to JSON at
  export time.

## Regenerating the base snapshot

`export/export-seed.py` runs on the benchmark VM (`fphd-benchmark`, resource group
`find-public-health-data-alpha` — deallocated when idle; its public IP changes on start),
then `export/transform-uuids.py` rekeys the integer-keyed export to UUIDv7 locally:

```sh
scp export/export-seed.py fphd@<vm-ip>:/tmp/
ssh fphd@<vm-ip> 'MSSQL_PASSWORD=<sa-password> python3 /tmp/export-seed.py /tmp/seed-out'
scp 'fphd@<vm-ip>:/tmp/seed-out/*.csv.gz' .
python3 export/transform-uuids.py .
```

The transform assigns sequential UUIDv7 ids in source-id order, remaps every foreign key,
and keeps the public Fingertips indicator number in `indicator.fingertips_id`. Adjust the
indicator list, geography set or year floors at the top of `export-seed.py`.

## Refreshing the prototype showcase locally

`export/import-prototype-indicators.py` imports Fingertips CSV/JSON downloads into the
local Docker database in one transaction. It validates geography coverage and foreign
keys, then writes only the changed seed tables to a staging directory. It never connects
to a remote database.

Start from the committed base seed, download indicator IDs 241, 93861 and 93995 plus area
types 6, 7, 221, 223, 501 and 502 from the public Fingertips API into a temporary
directory, then run:

```sh
docker compose up -d db
pnpm db:seed
python3 export/import-prototype-indicators.py \
  --data-csv /tmp/fphd-prototype-indicators.csv \
  --metadata-json /tmp/fphd-prototype-metadata.json \
  --area-types-json /tmp/fphd-area-types.json \
  --area-dir /tmp \
  --out-dir /tmp/fphd-seed-expanded
```

Validate the staging output before copying its nine `.csv.gz` files into this directory.
Then run `pnpm db:seed`, import the indicator relationships and rebuild read models to
prove the committed files reproduce the local database.
