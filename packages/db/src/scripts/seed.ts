import { seedDatabase } from '../seeding.js';
import { createOwnerClient } from './owner-client.js';

const sql = createOwnerClient();
try {
  // The seed erases and replaces every table, so it fails closed: it requires an
  // explicit APP_ENV of local or test rather than assuming a missing value is safe.
  const appEnv = process.env.APP_ENV;
  if (appEnv !== 'local' && appEnv !== 'test') {
    throw new Error(
      `Refusing to seed: APP_ENV is ${appEnv === undefined ? 'unset' : `'${appEnv}'`}; ` +
        `set it to 'local' or 'test' explicitly`,
    );
  }

  await seedDatabase(sql);
  console.log('Seed complete. Run db:rebuild-read-models to populate read models.');
} finally {
  await sql.end();
}
