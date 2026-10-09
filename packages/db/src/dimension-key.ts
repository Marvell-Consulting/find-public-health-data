/**
 * An observation's dimension_key: the ids of the dimension values it is bridged to, lowercased as
 * Postgres writes them, sorted and joined, and empty for a total. The migrations and the seed load
 * build the same string in SQL, `string_agg(dimension_value_id::text, ',' ORDER BY dimension_value_id)`.
 */
export function dimensionKey(dimensionValueIds: readonly string[]): string {
  return dimensionValueIds
    .map((id) => id.toLowerCase())
    .sort()
    .join(',');
}
