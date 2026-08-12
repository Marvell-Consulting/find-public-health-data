import type postgres from 'postgres';
import { beforeEach, describe, expect, it } from 'vitest';

import { SCHEMA_OWNER_ROLE } from './bootstrap.js';
import { createOwnerClient } from './scripts/owner-client.js';
import { createTestDatabase, type TestDatabase } from './testing.js';
import { assertVerified, verifyDatabase } from './verification.js';

let testDb: TestDatabase;
let sql: postgres.Sql;

// A database per test: each breaks a different invariant, and a shared one would leave the
// later tests asserting against damage the earlier ones did.
beforeEach(async () => {
  testDb = await createTestDatabase();
  sql = createOwnerClient(testDb.name);

  return async () => {
    await sql.end();
    await testDb.drop();
  };
});

function checksIn(findings: Awaited<ReturnType<typeof verifyDatabase>>): string[] {
  return findings.map((finding) => finding.check);
}

describe('verifyDatabase', () => {
  it('finds nothing wrong with a database the harness built', async () => {
    expect(await verifyDatabase(sql)).toEqual([]);
  });

  it('reports a table left owned by the login rather than the group', async () => {
    await sql`CREATE TABLE restored_by_hand (id int)`;
    await sql.unsafe('ALTER TABLE restored_by_hand OWNER TO CURRENT_USER');

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('object-ownership');
    expect(findings[0]?.subjects.join()).toContain('restored_by_hand');
  });

  // The state a logical restore leaves behind: every table present and correctly owned, but
  // the database-level grant absent, so the next migration cannot create the drizzle schema.
  it('reports the owner group having lost CREATE on the database', async () => {
    await sql.unsafe(`REVOKE CREATE ON DATABASE "${testDb.name}" FROM "${SCHEMA_OWNER_ROLE}"`);

    expect(checksIn(await verifyDatabase(sql))).toContain('owner-database-privilege');
  });

  it('reports the owner group having lost CREATE on schema public', async () => {
    await sql.unsafe(`REVOKE CREATE ON SCHEMA public FROM "${SCHEMA_OWNER_ROLE}"`);

    expect(checksIn(await verifyDatabase(sql))).toContain('owner-schema-privilege');
  });

  it('reports public_api being able to write, naming the privilege and table', async () => {
    await sql`GRANT INSERT ON topic TO public_api`;

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('public-api-read-only');
    expect(findings.flatMap((finding) => finding.subjects)).toContain('INSERT on topic');
  });

  // internal_api serves the publisher interface, so its writes are the design rather than a
  // regression. Pinned as a test because the obvious symmetry — check both roles — is wrong.
  it('accepts internal_api holding write privileges', async () => {
    await sql`GRANT INSERT, UPDATE, DELETE ON topic TO internal_api`;

    expect(await verifyDatabase(sql)).toEqual([]);
  });

  it('reports a table granted to PUBLIC, which no role needs its own grant to read', async () => {
    await sql`GRANT SELECT ON indicator TO PUBLIC`;

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('no-public-grants');
    expect(findings.flatMap((finding) => finding.subjects)).toContain('indicator');
  });

  it('reports every broken invariant in one run rather than the first', async () => {
    await sql`GRANT INSERT ON topic TO public_api`;
    await sql`GRANT SELECT ON indicator TO PUBLIC`;

    expect(checksIn(await verifyDatabase(sql))).toEqual([
      'public-api-read-only',
      'no-public-grants',
    ]);
  });
});

describe('assertVerified', () => {
  it('passes an empty set of findings', () => {
    expect(() => assertVerified([])).not.toThrow();
  });

  it('names every failing check in one error', () => {
    expect(() =>
      assertVerified([
        { check: 'object-ownership', detail: 'wrong owner', subjects: ['a'] },
        { check: 'no-public-grants', detail: 'world readable', subjects: ['b'] },
      ]),
    ).toThrow(/object-ownership: wrong owner; no-public-grants: world readable/);
  });
});
