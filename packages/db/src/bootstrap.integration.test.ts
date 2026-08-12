import { randomBytes } from 'node:crypto';

import { appEnvFields, parseEnv, z } from '@fphd/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bootstrapOwnerRole, bootstrapRoles, SCHEMA_OWNER_ROLE } from './bootstrap.js';
import { createPostgresClient } from './client.js';
import { dbEnvFields, resolveDbTls } from './env.js';
import { createOwnerClient } from './scripts/owner-client.js';
import { createTestDatabase, type TestDatabase } from './testing.js';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
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
      ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
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

async function ownerOf(table: string): Promise<string | undefined> {
  const rows = await owner`
    SELECT pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = ${table} AND n.nspname = 'public'
  `;
  return rows[0]?.owner as string | undefined;
}

describe('bootstrapOwnerRole', () => {
  it('leaves migrated tables owned by the group rather than the login that migrated them', async () => {
    expect(await ownerOf('indicator')).toBe(SCHEMA_OWNER_ROLE);
  });

  it('leaves the drizzle bookkeeping table owned by the group too', async () => {
    const rows = await owner`
      SELECT pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = '__drizzle_migrations' AND n.nspname = 'drizzle'
    `;
    expect(rows[0]?.owner).toBe(SCHEMA_OWNER_ROLE);
  });

  it('reassigns a table the login already owns, so an older database converges', async () => {
    await owner`CREATE TABLE predates_the_group (id int)`;
    expect(await ownerOf('predates_the_group')).not.toBe(SCHEMA_OWNER_ROLE);

    await bootstrapOwnerRole(owner);

    expect(await ownerOf('predates_the_group')).toBe(SCHEMA_OWNER_ROLE);
  });

  it('reassigns a table whose identity sequence it cannot alter on its own', async () => {
    await owner`CREATE TABLE predates_the_group_with_sequence (id serial PRIMARY KEY)`;

    await bootstrapOwnerRole(owner);

    expect(await ownerOf('predates_the_group_with_sequence')).toBe(SCHEMA_OWNER_ROLE);
    const sequence = await owner`
      SELECT pg_get_userbyid(c.relowner) AS owner FROM pg_class c
      WHERE c.relname = 'predates_the_group_with_sequence_id_seq'
    `;
    expect(sequence[0]?.owner).toBe(SCHEMA_OWNER_ROLE);
  });

  it('leaves extension-owned objects alone', async () => {
    await bootstrapOwnerRole(owner);

    const rows = await owner`
      SELECT count(*)::int AS count
      FROM pg_depend d
      JOIN pg_proc p ON p.oid = d.objid
      WHERE d.classid = 'pg_proc'::regclass
        AND d.deptype = 'e'
        AND pg_get_userbyid(p.proowner) = ${SCHEMA_OWNER_ROLE}
    `;
    expect(rows[0]?.count).toBe(0);
  });

  it('runs again against a database that already has the group', async () => {
    await bootstrapOwnerRole(owner);
    await bootstrapOwnerRole(owner);

    const rows = await owner`SELECT rolcanlogin FROM pg_roles WHERE rolname = ${SCHEMA_OWNER_ROLE}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rolcanlogin).toBe(false);
  });
});
