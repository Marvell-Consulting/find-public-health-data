import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { rebuildReadModels } from './read-models.js';
import { createOwnerClient } from './scripts/owner-client.js';
import { seedDatabase } from './seeding.js';

const TEMPLATE_DATABASE = 'fphd_test_template';
const TEST_DATABASE_PREFIX = 'fphd_test_';
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

async function dropTestDatabases(): Promise<void> {
  const admin = createOwnerClient('postgres');
  try {
    const leftovers = await admin`
      SELECT datname FROM pg_database WHERE datname LIKE ${`${TEST_DATABASE_PREFIX}%`}
    `;
    for (const { datname } of leftovers) {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
}

/**
 * Build the seeded template database the integration tier copies from: dropped and
 * recreated each run, migrated, seeded and with read models rebuilt. Runs once from
 * the root Vitest global setup.
 */
export async function setUpTestTemplate(): Promise<void> {
  await dropTestDatabases();
  const admin = createOwnerClient('postgres');
  try {
    await admin.unsafe(`CREATE DATABASE "${TEMPLATE_DATABASE}"`);
  } finally {
    await admin.end();
  }
  const template = createOwnerClient(TEMPLATE_DATABASE);
  try {
    await migrate(drizzle(template), { migrationsFolder });
    await seedDatabase(template);
    await rebuildReadModels(template);
  } finally {
    await template.end();
  }
}

export async function tearDownTestTemplate(): Promise<void> {
  await dropTestDatabases();
}

export interface TestDatabase {
  name: string;
  drop(): Promise<void>;
}

/**
 * Give a test file its own database copied from the seeded template, so files run
 * fully in parallel without sharing state. Copying is a fast file-level operation;
 * Postgres briefly locks the template during a copy, hence the retry.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `${TEST_DATABASE_PREFIX}${randomBytes(6).toString('hex')}`;
  const admin = createOwnerClient('postgres');
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE_DATABASE}"`);
        break;
      } catch (error) {
        if (attempt < 40 && (error as { code?: string }).code === '55006') {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        throw error;
      }
    }
  } finally {
    await admin.end();
  }
  return {
    name,
    async drop() {
      const cleanup = createOwnerClient('postgres');
      try {
        await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await cleanup.end();
      }
    },
  };
}
