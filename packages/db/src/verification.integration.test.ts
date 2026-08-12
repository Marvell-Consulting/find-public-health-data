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

  it('reports public_api holding a write path through an updatable view', async () => {
    await sql`CREATE VIEW topic_titles AS SELECT id, title FROM topic`;
    await sql.unsafe(`ALTER VIEW topic_titles OWNER TO "${SCHEMA_OWNER_ROLE}"`);
    await sql`GRANT INSERT ON topic_titles TO public_api`;

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('public-api-read-only');
    expect(findings.flatMap((finding) => finding.subjects)).toContain('INSERT on topic_titles');
  });

  it('reports public_api holding a column-level write grant', async () => {
    await sql`GRANT UPDATE (title) ON topic TO public_api`;

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('public-api-read-only');
    expect(findings.flatMap((finding) => finding.subjects)).toContain('UPDATE on topic');
  });

  // USAGE alone permits nextval, so a sequence grant is a write path too.
  it('reports public_api being able to advance a sequence', async () => {
    await sql`CREATE SEQUENCE restored_seq`;
    await sql.unsafe(`ALTER SEQUENCE restored_seq OWNER TO "${SCHEMA_OWNER_ROLE}"`);
    await sql`GRANT USAGE ON SEQUENCE restored_seq TO public_api`;

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('public-api-read-only');
    expect(findings.flatMap((finding) => finding.subjects)).toContain('USAGE on restored_seq');
  });

  it('reports public_api writes on a table outside schema public', async () => {
    await sql`CREATE SCHEMA staging`;
    await sql`CREATE TABLE staging.import (id int)`;
    await sql.unsafe(`ALTER TABLE staging.import OWNER TO "${SCHEMA_OWNER_ROLE}"`);
    await sql`GRANT INSERT ON staging.import TO public_api`;

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('public-api-read-only');
    expect(findings.flatMap((finding) => finding.subjects)).toContain('INSERT on staging.import');
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

  it('reports a sequence granted to PUBLIC', async () => {
    await sql`CREATE SEQUENCE shared_seq`;
    await sql.unsafe(`ALTER SEQUENCE shared_seq OWNER TO "${SCHEMA_OWNER_ROLE}"`);
    await sql`GRANT USAGE ON SEQUENCE shared_seq TO PUBLIC`;

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('no-public-grants');
    expect(findings.flatMap((finding) => finding.subjects)).toContain('shared_seq');
  });

  it('reports a column granted to PUBLIC', async () => {
    await sql`GRANT SELECT (title) ON topic TO PUBLIC`;

    const findings = await verifyDatabase(sql);

    expect(checksIn(findings)).toContain('no-public-grants');
    expect(findings.flatMap((finding) => finding.subjects)).toContain('topic');
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
