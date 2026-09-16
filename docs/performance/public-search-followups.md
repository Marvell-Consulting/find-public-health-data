# Public search loading measurements

The local seeded database has 13 indicators, 489,998 observations and 6,544 areas. These measurements establish a development baseline. It is not a representative full-size indicator import, so the required full-data selected-area plan remains outstanding.

On 16 September 2026, five sequential local requests to `/api/indicators/facets` took 4–15 ms each. Five requests to `/api/areas` for all six display groups with `limit=101` took 10–17 ms each. The grouped preview request uses one repository query. These measurements do not justify a cache, so no freshness or invalidation policy is needed yet.

The [seeded selected-area plan](selected-area-seed-plan.txt) ran `EXPLAIN (ANALYZE, BUFFERS)` for two selected areas, Cornwall (`E06000052`) and Manchester (`E08000003`), across approved indicators. It used `idx_obs_indicator_area_from` for observation lookups and completed in 4.3 ms with warm buffers. No database change is justified by that plan. Repeat the same query on a representative full-size import before closing the performance criterion.
