# Public search loading measurements

The local seeded database has 13 indicators, 489,998 observations and 6,544 areas. These measurements establish a development baseline.

On 16 September 2026, five sequential local requests to `/api/indicators/facets` took 4–15 ms each. Five requests to `/api/areas` for all six display groups with `limit=101` took 10–17 ms each. The grouped preview request uses one repository query. These measurements do not justify a cache, so no freshness or invalidation policy is needed yet.

The [seeded selected-area plan](selected-area-seed-plan.txt) ran `EXPLAIN (ANALYZE, BUFFERS)` for two selected areas, Cornwall (`E06000052`) and Manchester (`E08000003`), across approved indicators. It used `idx_obs_indicator_area_from` for observation lookups and completed in 4.3 ms, with 420 shared buffer hits and 96 reads.

The full-size import on the `fphd-benchmark` PostgreSQL database has 1,290 approved indicators and 29,380,899 observations. The [original full-size plan](selected-area-full-plan-before.txt) ran the same selected-area filter in 2,161 ms, with 18,628 shared buffer hits and 1,242 reads. Its correlated `EXISTS` subquery ran 1,290 times and performed 2,580 observation index scans. The [rewritten plan](selected-area-full-plan-after.txt) uses an uncorrelated `IN` subquery to group the two areas once. It completed in 41.6 ms, with 7,045 shared buffer hits and 5 reads. Both forms returned the same 960 indicator IDs, verified using `EXCEPT ALL` in both directions. The query rewrite is the smallest measured fix; the plans do not justify an additional index.

The original query follows the selected-area filter in `searchWithFilters`:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT i.id
FROM indicator i
WHERE i.status = 'approved'
  AND EXISTS (
    SELECT 1
    FROM observation o
    JOIN area a ON a.id = o.area_id
    WHERE o.indicator_id = i.id
      AND a.code IN ('E06000052', 'E08000003')
      AND o.deleted_at IS NULL
      AND o.value IS NOT NULL
    GROUP BY o.indicator_id
    HAVING count(DISTINCT a.code) = 2
  );
```

The revised condition replaces `EXISTS` with `i.id IN (SELECT o.indicator_id ... GROUP BY o.indicator_id HAVING count(DISTINCT a.code) = 2)`, removing the correlation on `o.indicator_id = i.id`. The remaining filters are unchanged.
