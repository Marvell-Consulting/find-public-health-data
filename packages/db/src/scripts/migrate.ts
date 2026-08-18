import { migrateToLatest } from '../migrations.js';
import { createOwnerClient } from './owner-client.js';

const sql = createOwnerClient();
try {
  await migrateToLatest(sql);
  console.log('Migrations applied.');
} finally {
  await sql.end();
}
