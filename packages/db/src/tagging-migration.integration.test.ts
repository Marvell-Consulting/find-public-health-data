import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrateToLatest } from './migrations.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, migrateBefore, type TestDatabase } from './testing.ts';

const MIGRATION = '0026_indicator-tagging';

// The classifications each version holds before the migration, keyed by its short id.
const TAGGED: Record<number, string[]> = {
  1: ['risk_factor'],
  2: ['framework', 'indicator_type'],
  3: ['risk_factor', 'framework'],
  4: ['population'],
  5: [],
};

let testDb: TestDatabase;
let sql: postgres.Sql;

beforeAll(async () => {
  testDb = await createTestDatabase({ template: 'unmigrated' });
  sql = createOwnerClient(testDb.name);
  await migrateBefore(sql, MIGRATION);

  for (const dimension of ['risk_factor', 'framework', 'indicator_type', 'population']) {
    await sql`
      INSERT INTO classification (dimension, slug, name)
      VALUES (${dimension}, ${`a-${dimension.replace('_', '-')}`}, ${dimension})
    `;
  }

  for (const [shortId, dimensions] of Object.entries(TAGGED)) {
    const [version] = await sql<{ id: string }[]>`
      WITH created AS (INSERT INTO indicator (short_id) VALUES (${Number(shortId)}) RETURNING id)
      INSERT INTO indicator_version (indicator_id, name, slug, created_by, updated_by)
      SELECT id, ${`Indicator ${shortId}`}, ${`indicator-${shortId}`}, 'migration-test', 'migration-test'
      FROM created
      RETURNING id
    `;
    for (const dimension of dimensions) {
      await sql`
        INSERT INTO indicator_classification (indicator_version_id, classification_id)
        SELECT ${version?.id ?? ''}, id FROM classification WHERE dimension = ${dimension}
      `;
    }
  }

  await migrateToLatest(sql);
});

afterAll(async () => {
  await sql?.end();
  await testDb?.drop();
});

describe(`migration ${MIGRATION}`, () => {
  it('answers yes where a version already has a risk factor or framework, and leaves the rest unanswered', async () => {
    const rows = await sql<
      { shortId: number; hasRiskFactor: boolean | null; hasFramework: boolean | null }[]
    >`
      SELECT i.short_id AS "shortId", v.has_risk_factor AS "hasRiskFactor", v.has_framework AS "hasFramework"
      FROM indicator_version v JOIN indicator i ON i.id = v.indicator_id
      ORDER BY i.short_id
    `;

    expect(rows).toEqual([
      { shortId: 1, hasRiskFactor: true, hasFramework: null },
      { shortId: 2, hasRiskFactor: null, hasFramework: true },
      { shortId: 3, hasRiskFactor: true, hasFramework: true },
      { shortId: 4, hasRiskFactor: null, hasFramework: null },
      { shortId: 5, hasRiskFactor: null, hasFramework: null },
    ]);
  });
});
