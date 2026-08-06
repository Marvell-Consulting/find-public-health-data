import { randomBytes } from 'node:crypto';

import { parseEnv, z } from '@fphd/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bootstrapRoles } from './bootstrap.js';
import { createPostgresClient } from './client.js';
import { dbEnvFields, resolveDbSsl } from './env.js';
import { createOwnerClient } from './scripts/owner-client.js';
import { createTestDatabase, type TestDatabase } from './testing.js';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    APP_ENV: z.string().default('local'),
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

let testDb: TestDatabase;
let owner: ReturnType<typeof createOwnerClient>;

// Login roles are cluster-wide, not per-database, so this file must never bootstrap
// public_api or internal_api: that would rotate the passwords the rest of the suite and the
// developer's compose stack are connecting with. Each test gets a name of its own instead,
// which also keeps the tests independent of the order they run in.
const createdRoles: string[] = [];

function uniqueRoleName(): string {
  const name = `fphd_bootstrap_test_${randomBytes(6).toString('hex')}`;
  createdRoles.push(name);
  return name;
}

async function canLogIn(role: string, password: string): Promise<boolean> {
  const sql = createPostgresClient(
    {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: testDb.name,
      user: role,
      password,
      ssl: resolveDbSsl(env.APP_ENV, env.DB_SSL),
    },
    { max: 1, onnotice: () => {} },
  );
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end();
  }
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  owner = createOwnerClient(testDb.name);
});

afterAll(async () => {
  for (const role of createdRoles) {
    await owner.unsafe(`DROP ROLE IF EXISTS "${role}"`);
  }
  await owner.end();
  await testDb.drop();
});

describe('bootstrapRoles', () => {
  it('creates a login role that authenticates with the given password', async () => {
    const role = uniqueRoleName();

    await bootstrapRoles(owner, [{ name: role, password: 'a-password' }]);

    expect(await canLogIn(role, 'a-password')).toBe(true);
  });

  it('leaves an existing role in place when run again', async () => {
    const role = uniqueRoleName();

    await bootstrapRoles(owner, [{ name: role, password: 'a-password' }]);
    await bootstrapRoles(owner, [{ name: role, password: 'a-password' }]);

    const rows = await owner`SELECT rolname FROM pg_roles WHERE rolname = ${role}`;
    expect(rows).toHaveLength(1);
    expect(await canLogIn(role, 'a-password')).toBe(true);
  });

  it('rotates the password of an existing role', async () => {
    const role = uniqueRoleName();

    await bootstrapRoles(owner, [{ name: role, password: 'old-password' }]);
    await bootstrapRoles(owner, [{ name: role, password: 'new-password' }]);

    expect(await canLogIn(role, 'new-password')).toBe(true);
    expect(await canLogIn(role, 'old-password')).toBe(false);
  });

  it('accepts a password containing quotes, backslashes and SQL punctuation', async () => {
    const role = uniqueRoleName();
    const awkward = String.raw`o'brien "quoted" \ ; --`;

    await bootstrapRoles(owner, [{ name: role, password: awkward }]);

    expect(await canLogIn(role, awkward)).toBe(true);
  });

  it('bootstraps every role it is given', async () => {
    const roles = [
      { name: uniqueRoleName(), password: 'first' },
      { name: uniqueRoleName(), password: 'second' },
    ];

    await bootstrapRoles(owner, roles);

    for (const role of roles) {
      expect(await canLogIn(role.name, role.password)).toBe(true);
    }
  });
});
