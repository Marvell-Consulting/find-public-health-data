import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type postgres from 'postgres';

// Resolves identically from src/ and from dist/, both of which sit one level under the
// package root alongside drizzle/.
export const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

/**
 * Applies pending migrations through drizzle-orm's migrator rather than `drizzle-kit
 * migrate`, so the deployed path needs no devDependency: drizzle-kit is a build-time tool
 * and is absent from a production install.
 */
export async function migrateToLatest(sql: postgres.Sql): Promise<void> {
  await migrate(drizzle(sql), { migrationsFolder });
}
