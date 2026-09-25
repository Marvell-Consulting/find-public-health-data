import { randomBytes } from 'node:crypto';

import type postgres from 'postgres';

import type { Repositories } from './repositories.ts';
import { createOwnerClient } from './scripts/owner-client.ts';

export { createOwnerClient, loadOwnerEnv } from './scripts/owner-client.ts';

/**
 * Two templates, because most integration tests do not want the seed. Copying `seeded`
 * duplicates ~490k observations and ~759k bridge rows; a test that only exercises the
 * topics table should not pay for that. `@fphd/db-operations/testing` builds them.
 */
export const TEMPLATES = {
  schema: 'fphd_test_schema',
  seeded: 'fphd_test_seeded',
} as const;

export type TestTemplate = keyof typeof TEMPLATES;

export const TEST_DATABASE_PREFIX = 'fphd_test_';

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

export interface TestDatabase {
  name: string;
  drop(): Promise<void>;
}

export interface CreateTestDatabaseOptions {
  /**
   * `schema` (the default) is migrated and empty — ask for it unless the test asserts
   * something about the committed seed. `seeded` additionally has the seed loaded and the
   * read models rebuilt. `unmigrated` is a fresh database with no migrations applied.
   */
  template?: TestTemplate | 'unmigrated';
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
    if (template === 'unmigrated') {
      // Nothing else connects to the default template, so no need to queue for the lock.
      await admin.unsafe(`CREATE DATABASE "${name}"`);
    } else {
      await withCopyLock(admin, () =>
        admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATES[template]}"`),
      );
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
    areas: withThrowingDefaults('areas', overrides.areas),
    indicators: withThrowingDefaults('indicators', overrides.indicators),
    topics: withThrowingDefaults('topics', overrides.topics),
  };
}

/** Shared with `@fphd/internal-api-features/testing`, whose fakes throw the same way. */
export function withThrowingDefaults<T extends object>(name: string, stubs: Partial<T> = {}): T {
  return new Proxy(stubs as T, {
    get(target, property, receiver) {
      // Symbols are left alone so an accidental await or console.log of the object behaves
      // normally rather than resolving a throwing `then`.
      if (typeof property === 'symbol') {
        return Reflect.get(target, property, receiver);
      }

      const stub = Reflect.get(target, property, receiver);
      if (stub !== undefined) {
        return stub;
      }

      return () => {
        throw new Error(
          `The ${name} repository was called (.${property}) but this test did not stub it`,
        );
      };
    },
  });
}
