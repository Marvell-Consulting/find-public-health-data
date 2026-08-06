import { assertSeedingAllowed, seedDatabase } from '../seeding.js';
import { createOwnerClient } from './owner-client.js';

const sql = createOwnerClient();
try {
  assertSeedingAllowed(process.env.APP_ENV);

  await seedDatabase(sql);
  console.log('Seed complete. Run db:rebuild-read-models to populate read models.');
} finally {
  await sql.end();
}
