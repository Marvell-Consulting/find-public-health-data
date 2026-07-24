# Seed data

Real Pholio data exported from the benchmark MSSQL database `fphd_new` (the corrected
bridge/registry migration of PHOLIO_LIVE_A), as gzipped CSVs loaded by `pnpm db:seed`.

## What is in it

Reference and registry tables (lookups, dimension types and values, area types, note
types) are complete. Areas, observations and bridge rows are filtered to:

- **10 indicators**, chosen for diverse value types and dimension shapes:

  | ID | Indicator | Why |
  |---|---|---|
  | 108 | Under 75 mortality rate from all causes | DSR; sex, age, deprivation deciles |
  | 40501 | Under 75 mortality rate from cancer | DSR; same shapes, second mortality series |
  | 90366 | Life expectancy at birth | Rate ratio; always sexed, deprivation trend deciles |
  | 90851 | % resident in each deprivation quintile | Proportion; IMD2010/2015 quintiles |
  | 92026 | Reception prevalence of obesity | Proportion; ethnicity (17 groups), deprivation quintiles |
  | 92033 | Year 6 prevalence of obesity | Proportion; pairs with 92026 for comparisons |
  | 92443 | Smoking prevalence in adults (current) | Proportion; 15+ dimension types incl. socioeconomic, tenure, religion, sexuality |
  | 92708 | Resident population | Count; sex × age-band population pyramids |
  | 93622 | Community mental health contacts | Deprivation quintile within area (IMD2019) |
  | 94194 | Emergency admissions for gastroenteritis (0–4) | Crude rate; deprivation deciles |

- **Core administrative geographies** (area_type ids 15 England, 6 statistical regions,
  180 counties, 170 unitary authorities, 160 lower-tier local authorities) — no NHS
  hierarchy, small-area or GP-practice data.
- **2015 onwards** (2021 onwards for 92708, whose full sex × age × year matrix would
  dominate the seed).

That yields ~356k observations, ~632k bridge rows and ~74k observation notes.

## Semantics worth knowing

- An observation's aggregate ("Persons, all ages") is expressed by the **absence** of a
  dimension bridge row, not by aggregate-flagged dimension values. Some indicators have
  no fully-aggregate observations at all (life expectancy is always sexed), so
  `latest_headline` — which follows the alpha benchmark's definition of headline =
  observation with zero bridge rows — only has rows for 92708 and 93622. Refining
  headline semantics is ISS106 read-model design work.
- `indicator.config` was converted from Pholio's `key:value,key:value` text to JSON at
  export time.

## Regenerating

`export/export-seed.py` runs on the benchmark VM (`fphd-benchmark`, resource group
`find-public-health-data-alpha` — deallocated when idle; its public IP changes on start):

```sh
scp export/export-seed.py fphd@<vm-ip>:/tmp/
ssh fphd@<vm-ip> 'MSSQL_PASSWORD=<sa-password> python3 /tmp/export-seed.py /tmp/seed-out'
scp 'fphd@<vm-ip>:/tmp/seed-out/*.csv.gz' .
```

Adjust the indicator list, geography set or year floors at the top of the script.
