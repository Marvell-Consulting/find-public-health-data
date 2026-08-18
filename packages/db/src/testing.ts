import { randomBytes } from 'node:crypto';

import type postgres from 'postgres';

import { migrateToLatest } from './migrations.js';
import { rebuildReadModels } from './read-models.js';
import type { Repositories } from './repositories.js';
import { createOwnerClient } from './scripts/owner-client.js';
import { seedDatabase } from './seeding.js';

/**
 * Two templates, because most integration tests do not want the seed. Copying `seeded`
 * duplicates ~356k observations and ~632k bridge rows; a test that only exercises the
 * topics table should not pay for that.
 */
const TEMPLATES = {
  schema: 'fphd_test_schema',
  seeded: 'fphd_test_seeded',
} as const;

export type TestTemplate = keyof typeof TEMPLATES;

const TEST_DATABASE_PREFIX = 'fphd_test_';

/**
 * Postgres refuses `CREATE DATABASE ... TEMPLATE` while any other session is connected to
 * the template, so concurrent copies must take turns. An advisory lock makes them queue;
 * the previous approach raced and retried on the resulting error, which cannot be made
 * reliable — it only shifts how long you wait before failing.
 */
const COPY_LOCK_KEY = 0x66706864; // 'fphd'

async function withCopyLock<T>(admin: postgres.Sql, run: () => Promise<T>): Promise<T> {
  await admin`SELECT pg_advisory_lock(${COPY_LOCK_KEY})`;
  try {
    return await run();
  } finally {
    await admin`SELECT pg_advisory_unlock(${COPY_LOCK_KEY})`;
  }
}

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

async function buildTemplate(name: string, seed: boolean): Promise<void> {
  const admin = createOwnerClient('postgres');
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const template = createOwnerClient(name);
  try {
    await migrateToLatest(template);
    if (seed) {
      await seedDatabase(template);
      await rebuildReadModels(template);
    }
  } finally {
    // Left with no connections: a template with an open session cannot be copied.
    await template.end();
  }
}

/**
 * Build the templates the integration tier copies from, dropped and recreated each run.
 * Runs once from the root Vitest global setup, where there is no hook timeout and nothing
 * else is competing for the templates.
 */
export async function setUpTestTemplate(): Promise<void> {
  await dropTestDatabases();
  await buildTemplate(TEMPLATES.schema, false);
  await buildTemplate(TEMPLATES.seeded, true);
}

export async function tearDownTestTemplate(): Promise<void> {
  await dropTestDatabases();
}

export interface TestDatabase {
  name: string;
  drop(): Promise<void>;
}

export interface CreateTestDatabaseOptions {
  /**
   * `schema` (the default) is migrated and empty — ask for it unless the test asserts
   * something about the committed seed. `seeded` additionally has the seed loaded and the
   * read models rebuilt.
   */
  template?: TestTemplate;
}

/**
 * Give a test file its own database, so files run in parallel without sharing state and a
 * test that writes need not clean up after itself.
 */
export async function createTestDatabase({
  template = 'schema',
}: CreateTestDatabaseOptions = {}): Promise<TestDatabase> {
  const name = `${TEST_DATABASE_PREFIX}${randomBytes(6).toString('hex')}`;
  const admin = createOwnerClient('postgres');
  try {
    await withCopyLock(admin, () =>
      admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATES[template]}"`),
    );
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

/**
 * Repositories for an app-level unit test. Anything the test does not stub throws when
 * called, so a handler reaching for data the test did not intend to provide fails loudly
 * instead of quietly receiving an empty result. Stubs are per-method: a test that only
 * exercises `topics.list` supplies only that.
 */
export type FakeRepositoryOverrides = {
  [K in keyof Repositories]?: Partial<Repositories[K]>;
};

export function createFakeRepositories(overrides: FakeRepositoryOverrides = {}): Repositories {
  return {
    indicators: withThrowingDefaults('indicators', overrides.indicators),
    topics: withThrowingDefaults('topics', overrides.topics),
  };
}

function withThrowingDefaults<T extends object>(name: string, stubs: Partial<T> = {}): T {
  return new Proxy(stubs as T, {
    get(target, property, receiver) {
      // Symbols are left alone so an accidental await or console.log of the object behaves
      // normally rather than resolving a throwing `then`.
      if (typeof property === 'symbol') {
        return Reflect.get(target, property, receiver);
      }

      if (Object.prototype.hasOwnProperty.call(target, property)) {
        return Reflect.get(target, property, receiver);
      }

      return () => {
        throw new Error(
          `The ${name} repository was called (.${property}) but this test did not stub it`,
        );
      };
    },
  });
}
