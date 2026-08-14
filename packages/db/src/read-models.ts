import type postgres from 'postgres';

/**
 * Rebuild the three derived read-model tables from the canonical tables, atomically.
 *
 * The queries mirror the alpha benchmark's cache builds. A headline observation is one
 * with no dimension bridge rows at all; indicators that publish every observation with
 * an intrinsic dimension profile (for example life expectancy, which is always sexed)
 * have no headline rows under this definition. Refining headline semantics is part of
 * the ISS106 read-model design, not this skeleton.
 */
export async function rebuildReadModels(sql: postgres.Sql): Promise<void> {
  await sql.begin((tx) => rebuildReadModelTables(tx));
  await analyzeReadModels(sql);
}

/** The transaction-aware body, so a caller can commit a seed and this rebuild as one. */
export async function rebuildReadModelTables(tx: postgres.TransactionSql): Promise<void> {
  // DELETE rather than TRUNCATE: it takes only row locks, so readers keep seeing
  // the previous read models until the rebuild commits.
  await tx`DELETE FROM latest_headline`;
  await tx`DELETE FROM available_data`;
  await tx`DELETE FROM indicator_dimension_values`;

  await tx`
      INSERT INTO latest_headline
        (indicator_id, area_id, from_date, to_date, value, lower_ci_95, upper_ci_95)
      SELECT DISTINCT ON (indicator_id, area_id)
        indicator_id, area_id, from_date, to_date, value, lower_ci_95, upper_ci_95
      FROM observation o
      WHERE o.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM observation_dimension od WHERE od.observation_id = o.id
        )
      ORDER BY indicator_id, area_id, from_date DESC, to_date DESC, id DESC
    `;

  await tx`
      INSERT INTO available_data (indicator_id, area_type_id, area_type_name, area_count)
      SELECT o.indicator_id, a.area_type_id, MAX(at.name), COUNT(DISTINCT o.area_id)
      FROM observation o
      JOIN area a ON a.id = o.area_id
      JOIN area_type at ON at.id = a.area_type_id
      WHERE o.deleted_at IS NULL
      GROUP BY o.indicator_id, a.area_type_id
    `;

  await tx`
      INSERT INTO indicator_dimension_values
        (indicator_id, dimension_type_id, dimension_type_name,
         dimension_value_id, dimension_value_name, sort_order)
      SELECT DISTINCT o.indicator_id, dt.id, dt.name, dv.id, dv.name, dv.sort_order
      FROM observation o
      JOIN observation_dimension od ON od.observation_id = o.id
      JOIN dimension_value dv ON dv.id = od.dimension_value_id
      JOIN dimension_type dt ON dt.id = dv.dimension_type_id
      WHERE o.deleted_at IS NULL
    `;
}

export async function analyzeReadModels(sql: postgres.Sql): Promise<void> {
  await sql`ANALYZE latest_headline`;
  await sql`ANALYZE available_data`;
  await sql`ANALYZE indicator_dimension_values`;
}
