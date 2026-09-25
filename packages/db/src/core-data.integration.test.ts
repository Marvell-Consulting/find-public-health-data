import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertCoreDataPresent, importCoreData } from './core-data.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

describe('assertCoreDataPresent', () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    sql = createOwnerClient(testDb.name);
  });

  afterAll(async () => {
    await sql.end();
    await testDb.drop();
  });

  it('asks for the core data import before any is imported', async () => {
    await expect(assertCoreDataPresent(sql)).rejects.toThrow(
      'No topics in the database — run `db import-core-data` before seeding',
    );
  });

  it('passes once the core data is imported', async () => {
    await importCoreData(sql);

    await expect(assertCoreDataPresent(sql)).resolves.toBeUndefined();
  });

  it('asks for the core data import when there are topics but no data providers', async () => {
    await sql`DELETE FROM data_provider_source`;
    await sql`DELETE FROM data_provider`;

    await expect(assertCoreDataPresent(sql)).rejects.toThrow(
      'No data providers in the database — run `db import-core-data` before seeding',
    );
  });
});

describe('assertCoreDataPresent before migrating', () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    testDb = await createTestDatabase({ template: 'unmigrated' });
    sql = createOwnerClient(testDb.name);
  });

  afterAll(async () => {
    await sql.end();
    await testDb.drop();
  });

  it('asks for the migrations', async () => {
    await expect(assertCoreDataPresent(sql)).rejects.toThrow(
      'The core data tables are missing — run `db migrate` before seeding',
    );
  });
});
