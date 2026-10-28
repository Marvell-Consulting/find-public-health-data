import { recentTrendDirection, type TrendDirection } from '@fphd/utils/recent-trend';
import { inArray, sql } from 'drizzle-orm';
import type { Database } from './client.ts';
import {
  publishedArea as area,
  publishedObservation as observation,
  publishedObservationDimension as observationDimension,
} from './schema/index.ts';

/** The least-disaggregated, longest England series, with only its five latest valid values returned. */
export async function indicatorTrendDirections(
  db: Database,
  ids: string[],
): Promise<Map<string, TrendDirection>> {
  if (ids.length === 0) return new Map();
  const rows = await db.execute<{ indicator_id: string; values: number[] }>(sql`
    with points as (
      select ${observation.indicatorId} as indicator_id, ${observation.fromDate} as from_date,
        ${observation.toDate} as to_date, ${observation.value} as value,
        d.dimensions, d.segment
      from ${observation}
      join ${area} on ${area.id} = ${observation.areaId} and ${area.code} = 'E92000001'
      cross join lateral (
        select count(${observationDimension.id}) as dimensions,
          coalesce(string_agg(${observationDimension.dimensionValueId}::text, '|' order by ${observationDimension.dimensionValueId}), '') as segment
        from ${observationDimension}
        where ${observationDimension.observationId} = ${observation.id}
      ) d
      where ${inArray(observation.indicatorId, ids)}
    ), series as (
      select indicator_id, dimensions, segment, count(value) as length,
        (array_agg(value order by from_date desc, to_date desc) filter (where value is not null))[1:5] as values
      from points group by indicator_id, dimensions, segment
    )
    select distinct on (indicator_id) indicator_id, coalesce(values, '{}') as values
    from series order by indicator_id, dimensions, length desc, segment
  `);
  return new Map(
    rows.map(({ indicator_id, values }) => [
      indicator_id,
      recentTrendDirection([...values].reverse()),
    ]),
  );
}
