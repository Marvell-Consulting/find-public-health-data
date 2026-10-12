import type postgres from 'postgres';

/**
 * A draft with a loaded data table, which the seed has none of: every current area for 8 years,
 * Female and Male, about 105,000 rows, as an upload would have stored them. Its dates are old, so
 * the dashboard lists it last.
 */
export const DATA_TABLE_DRAFT = {
  indicatorId: '01a00000-0000-7000-8000-0000000f4040',
  versionId: '01a00000-0000-7000-8000-0000000f4041',
  batchId: '01a00000-0000-7000-8000-0000000f4042',
};

const YEARS = 8;

/** Writes the draft unless an earlier run already has. */
export async function createDataTableDraft(sql: postgres.Sql): Promise<void> {
  const { indicatorId, versionId, batchId } = DATA_TABLE_DRAFT;
  const [existing] = await sql`select 1 from indicator where id = ${indicatorId}`;
  if (existing !== undefined) return;

  await sql.begin(async (tx) => {
    await tx`insert into indicator (id, created_at) values (${indicatorId}, '2000-01-01')`;
    await tx`
      insert into indicator_version
        (id, indicator_id, name, slug, created_at, updated_at, created_by, updated_by)
      values (${versionId}, ${indicatorId}, 'Route budget data table', 'route-budget-data-table',
        '2000-01-01', '2000-01-01', 'perf', 'perf')`;
    await tx`
      insert into upload_batch
        (id, indicator_id, indicator_version_id, original_filename, uploaded_by, uploaded_at,
         status, column_names)
      values (${batchId}, ${indicatorId}, ${versionId}, 'data.csv', 'perf', '2000-01-01',
        'processed', ${['area_code', 'period_start', 'period_end', 'value', 'sex']})`;
    await tx`
      with sex as (
        select dv.id, dv.dimension_type_id
        from dimension_value dv
        join dimension_type dt on dt.id = dv.dimension_type_id
        where dt.name = 'Sex' and dv.name in ('Female', 'Male')
      ),
      inserted as (
        insert into observation (
          id, indicator_id, area_id, from_date, to_date, value, upload_batch_id, dimension_key,
          created_by
        )
        select uuidv7(), ${indicatorId}, a.id, make_date(2015 + y, 1, 1),
          make_date(2015 + y, 12, 31), (row_number() over () % 1000) / 10.0, ${batchId},
          lower(sex.id::text), 'perf'
        from area a
        cross join generate_series(1, ${YEARS}) y
        cross join sex
        where a.valid_to is null
        returning id, dimension_key
      )
      insert into observation_dimension (observation_id, dimension_value_id, dimension_type_id)
      select inserted.id, sex.id, sex.dimension_type_id
      from inserted
      join sex on lower(sex.id::text) = inserted.dimension_key`;
    await tx`
      update upload_batch
      set row_count = (select count(*) from observation where upload_batch_id = ${batchId})
      where id = ${batchId}`;
    await tx`
      update indicator_version set upload_batch_id = ${batchId} where id = ${versionId}`;
  });
}
