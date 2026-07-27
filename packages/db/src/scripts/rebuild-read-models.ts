import { rebuildReadModels } from '../read-models.js';
import { createOwnerClient } from './owner-client.js';

const sql = createOwnerClient();
try {
  await rebuildReadModels(sql);
  for (const table of ['latest_headline', 'available_data', 'indicator_dimension_values']) {
    const rows = await sql`SELECT count(*)::int AS count FROM ${sql(table)}`;
    console.log(`${table}: ${rows[0]?.count} rows`);
  }
} finally {
  await sql.end();
}
