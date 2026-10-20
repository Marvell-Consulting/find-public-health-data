import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SYSTEM_USER_IDS } from './schema/index.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, migrateBefore, migrateThrough, type TestDatabase } from './testing.ts';

const MIGRATION = '0048_topic-actors';

describe(`migration ${MIGRATION}`, () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;
  let topicId: string;

  beforeAll(async () => {
    testDb = await createTestDatabase({ template: 'unmigrated' });
    sql = createOwnerClient(testDb.name);
    await migrateBefore(sql, MIGRATION);
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO topic (slug, title, description) VALUES ('older', 'Older', 'From before.')
      RETURNING id
    `;
    topicId = row?.id ?? '';
    await migrateThrough(sql, MIGRATION);
  });

  afterAll(async () => {
    await sql?.end();
    await testDb?.drop();
  });

  it('inserts the core data import as a system user', async () => {
    const rows = await sql`
      SELECT display_name, kind FROM app_user WHERE id = ${SYSTEM_USER_IDS.coreDataImport}
    `;

    expect(rows).toEqual([{ display_name: 'Core data import', kind: 'system' }]);
  });

  it('attributes an existing topic to the core data import', async () => {
    const [row] = await sql`SELECT created_by, updated_by FROM topic WHERE id = ${topicId}`;

    expect(row).toEqual({
      created_by: SYSTEM_USER_IDS.coreDataImport,
      updated_by: SYSTEM_USER_IDS.coreDataImport,
    });
  });

  it('refuses a topic without a writer', async () => {
    await expect(
      sql`INSERT INTO topic (slug, title, description) VALUES ('new', 'New', 'No writer.')`,
    ).rejects.toMatchObject({ code: '23502' });
  });
});
