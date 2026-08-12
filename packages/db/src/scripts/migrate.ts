import { bootstrapOwnerRole } from '../bootstrap.js';
import { migrateToLatest } from '../migrations.js';
import { createOwnerClient } from './owner-client.js';

const sql = createOwnerClient();
try {
  // A dev volume initialised before the owner group existed would fail at SET ROLE;
  // idempotent, so on a current database it is a no-op.
  await bootstrapOwnerRole(sql);
  await migrateToLatest(sql);
  console.log('Migrations applied.');
} finally {
  await sql.end();
}
