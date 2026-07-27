import { describe, expect, it } from 'vitest';

import { rebuildReadModels } from './read-models.js';
import { createOwnerClient } from './scripts/owner-client.js';

// Requires a migrated, seeded database (see packages/db/README.md). CI runs
// db:migrate + db:seed before this tier.
const sql = createOwnerClient();

describe('bridge/registry schema', () => {
  it('holds the seeded indicators', async () => {
    const rows = await sql`SELECT count(*)::int AS count FROM indicator`;
    expect(rows[0]?.count).toBe(10);
  });

  it('holds observations for every seeded indicator', async () => {
    const orphaned = await sql`
      SELECT i.id FROM indicator i
      WHERE NOT EXISTS (SELECT 1 FROM observation o WHERE o.indicator_id = i.id)
    `;
    expect(orphaned).toHaveLength(0);
  });

  it('rejects an observation referencing an unknown indicator', async () => {
    await expect(sql`
      INSERT INTO observation
        (indicator_id, area_id, from_date, to_date, published_at, upload_batch_id, created_by)
      SELECT 999999999, a.id, '2024-01-01', '2024-12-31', now(), ub.id, 'integration-test'
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
        SELECT ub.indicator_id, ub.id AS batch, (SELECT min(id) FROM area) AS area_id
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

  it('resynced identity sequences past the seeded ids', async () => {
    const inserted = await sql.begin(async (tx) => {
      const returned = await tx`
        INSERT INTO value_type (name) VALUES ('integration-test-value-type')
        RETURNING id
      `;
      const id = Number(returned[0]?.id);
      const maxRows = await tx`
        SELECT max(id)::int AS max FROM value_type WHERE id <> ${id}
      `;
      await tx`DELETE FROM value_type WHERE id = ${id}`;
      return { id, max: Number(maxRows[0]?.max) };
    });
    expect(inserted.id).toBeGreaterThan(inserted.max);
  });

  it('rebuilds populated read models', async () => {
    await rebuildReadModels(sql);
    for (const table of ['latest_headline', 'available_data', 'indicator_dimension_values']) {
      const rows = await sql.unsafe(`SELECT count(*)::int AS count FROM "${table}"`);
      expect(Number(rows[0]?.count), table).toBeGreaterThan(0);
    }
  });
});
