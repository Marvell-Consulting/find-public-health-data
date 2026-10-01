import { UNIT_IDS } from '@fphd/utils/value-type-and-unit';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, migrateBefore, migrateThrough, type TestDatabase } from './testing.ts';

const MIGRATION = '0042_drop-unit-detail-length-check';

describe(`migration ${MIGRATION}`, () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    testDb = await createTestDatabase({ template: 'unmigrated' });
    sql = createOwnerClient(testDb.name);
    await migrateBefore(sql, MIGRATION);
  });

  afterAll(async () => {
    await sql?.end();
    await testDb?.drop();
  });

  function addDraftWithUnitDetail(shortId: number, unitDetail: string) {
    return sql`
      WITH created AS (INSERT INTO indicator (short_id) VALUES (${shortId}) RETURNING id)
      INSERT INTO indicator_version
        (indicator_id, name, slug, unit_id, unit_detail, created_by, updated_by)
      SELECT created.id, ${`Indicator ${shortId}`}, ${`indicator-${shortId}`},
             ${UNIT_IDS.other}, ${unitDetail}, 'migration-test', 'migration-test'
      FROM created
    `;
  }

  it('leaves the length of an other unit to the contract', async () => {
    const long = 'x'.repeat(10_001);

    await expect(addDraftWithUnitDetail(1, long)).rejects.toMatchObject({
      constraint_name: 'indicator_version_unit_detail_length_check',
    });

    await migrateThrough(sql, MIGRATION);

    await expect(addDraftWithUnitDetail(2, long)).resolves.toHaveProperty('count', 1);
  });
});
