import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { READ_MODEL_TABLES, rebuildReadModels } from './read-models.js';
import { createOwnerClient } from './scripts/owner-client.js';
import { createTestDatabase, type TestDatabase } from './testing.js';

const MISSING_UUID = '00000000-0000-0000-0000-000000000000';

let testDb: TestDatabase;
let sql: postgres.Sql;

beforeAll(async () => {
  testDb = await createTestDatabase({ template: 'seeded' });
  sql = createOwnerClient(testDb.name);
});

afterAll(async () => {
  await sql.end();
  await testDb.drop();
});

describe('bridge/registry schema', () => {
  it('holds the seeded indicators', async () => {
    const rows = await sql`SELECT count(*)::int AS count FROM indicator`;
    expect(rows[0]?.count).toBe(13);
  });

  it('holds observations for every seeded indicator', async () => {
    const orphaned = await sql`
      SELECT i.id FROM indicator i
      WHERE NOT EXISTS (SELECT 1 FROM observation o WHERE o.indicator_id = i.id)
    `;
    expect(orphaned).toHaveLength(0);
  });

  it('generates time-ordered uuidv7 ids by default', async () => {
    const rows = await sql`
      INSERT INTO value_type (name) VALUES ('integration-test-value-type')
      RETURNING id
    `;
    const id = rows[0]?.id as string;
    await sql`DELETE FROM value_type WHERE id = ${id}`;
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('rejects an observation referencing an unknown indicator', async () => {
    await expect(sql`
      INSERT INTO observation
        (indicator_id, area_id, from_date, to_date, published_at, upload_batch_id, created_by)
      SELECT ${MISSING_UUID}, a.id, '2024-01-01', '2024-12-31', now(), ub.id, 'integration-test'
      FROM area a, upload_batch ub LIMIT 1
    `).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects a dimension type outside the permitted classes', async () => {
    await expect(sql`
      INSERT INTO dimension_type (name, dimension_class)
      VALUES ('integration-test-bogus', 'bogus')
    `).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects a second value of the same dimension type on one observation', async () => {
    const failed = sql.begin(async (tx) => {
      const rows = await tx`
        SELECT od.observation_id, od.dimension_type_id, dv.id AS other_value
        FROM observation_dimension od
        JOIN dimension_value dv
          ON dv.dimension_type_id = od.dimension_type_id AND dv.id <> od.dimension_value_id
        LIMIT 1
      `;
      const target = rows[0];
      await tx`
        INSERT INTO observation_dimension (observation_id, dimension_value_id, dimension_type_id)
        VALUES (${target?.observation_id}, ${target?.other_value}, ${target?.dimension_type_id})
      `;
    });
    await expect(failed).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects an observation whose batch belongs to another indicator', async () => {
    const failed = sql.begin(async (tx) => {
      const rows = await tx`
        SELECT o.indicator_id, o.area_id, ub.id AS other_batch
        FROM observation o
        JOIN upload_batch ub ON ub.indicator_id <> o.indicator_id
        LIMIT 1
      `;
      const target = rows[0];
      await tx`
        INSERT INTO observation
          (indicator_id, area_id, from_date, to_date, published_at, upload_batch_id, created_by)
        VALUES
          (${target?.indicator_id}, ${target?.area_id}, '2024-01-01', '2024-12-31', now(),
           ${target?.other_batch}, 'integration-test')
      `;
    });
    await expect(failed).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects an observation period ending before it starts', async () => {
    const failed = sql.begin(async (tx) => {
      const rows = await tx`
        SELECT ub.indicator_id, ub.id AS batch, (SELECT id FROM area LIMIT 1) AS area_id
        FROM upload_batch ub
        LIMIT 1
      `;
      const target = rows[0];
      await tx`
        INSERT INTO observation
          (indicator_id, area_id, from_date, to_date, published_at, upload_batch_id, created_by)
        VALUES
          (${target?.indicator_id}, ${target?.area_id}, '2024-12-31', '2024-01-01', now(),
           ${target?.batch}, 'integration-test')
      `;
    });
    await expect(failed).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects overlapping validity ranges for one area code', async () => {
    const failed = sql.begin(async (tx) => {
      const areaTypes = await tx`SELECT id FROM area_type LIMIT 1`;
      const areaTypeId = areaTypes[0]?.id;
      await tx`
        INSERT INTO area (code, name, area_type_id, valid_from, valid_to)
        VALUES ('ITEST1', 'overlap a', ${areaTypeId}, '2020-01-01', NULL)
      `;
      await tx`
        INSERT INTO area (code, name, area_type_id, valid_from, valid_to)
        VALUES ('ITEST1', 'overlap b', ${areaTypeId}, '2022-01-01', NULL)
      `;
    });
    await expect(failed).rejects.toMatchObject({ code: '23P01' });
  });

  it('rebuilds populated read models', async () => {
    await rebuildReadModels(sql);
    for (const table of READ_MODEL_TABLES) {
      const rows = await sql.unsafe(`SELECT count(*)::int AS count FROM "${table}"`);
      expect(Number(rows[0]?.count), table).toBeGreaterThan(0);
    }
  });
});
