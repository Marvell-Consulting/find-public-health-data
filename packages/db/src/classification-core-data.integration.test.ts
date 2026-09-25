import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseClassificationsFile, upsertClassifications } from './classification-core-data.ts';
import { createDbFromClient } from './client.ts';
import type { ClassificationRecord } from './schema/index.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

const committed = parseClassificationsFile(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../data/classifications.json', import.meta.url)), 'utf-8'),
  ),
);

describe('the committed core data and seed', () => {
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

  it('hold the classifications in the file and nothing else', async () => {
    const rows = await sql<ClassificationRecord[]>`
      SELECT dimension, slug, name FROM classification ORDER BY slug
    `;

    expect(rows).toEqual([...committed].sort((a, b) => a.slug.localeCompare(b.slug)));
  });

  it('answer yes to a risk factor or framework exactly where the seed gives one', async () => {
    const rows = await sql<{ dimension: string; answered: boolean | null; linked: boolean }[]>`
      SELECT d.dimension,
        CASE d.dimension WHEN 'risk_factor' THEN v.has_risk_factor ELSE v.has_framework END AS answered,
        EXISTS (
          SELECT 1 FROM indicator_classification ic
          JOIN classification c ON c.id = ic.classification_id
          WHERE ic.indicator_version_id = v.id AND c.dimension = d.dimension
        ) AS linked
      FROM indicator_version v
      CROSS JOIN (VALUES ('risk_factor'), ('framework')) AS d(dimension)
    `;

    expect(rows.some(({ linked }) => linked)).toBe(true);
    expect(rows.filter(({ linked, answered }) => linked !== (answered === true))).toEqual([]);
    // Nothing the seed leaves untagged is answered "No".
    expect(rows.filter(({ answered }) => answered === false)).toEqual([]);
  });
});

describe('upsertClassifications', () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  const outcome: ClassificationRecord = {
    dimension: 'indicator_type',
    slug: 'indicator-type-outcome',
    name: 'Outcome',
  };

  beforeAll(async () => {
    testDb = await createTestDatabase();
    sql = createOwnerClient(testDb.name);
  });

  afterAll(async () => {
    await sql.end();
    await testDb.drop();
  });

  it('matches on slug, keeping the id of a row it rewrites, and reports strays', async () => {
    const db = createDbFromClient(sql);
    await sql`
      INSERT INTO classification (dimension, slug, name)
      VALUES ('population', 'population-no-file-lists', 'A population no file lists')
    `;

    const first = await upsertClassifications(db, [outcome]);
    const [before] = await sql<{ id: string }[]>`
      SELECT id FROM classification WHERE slug = ${outcome.slug}
    `;
    const again = await upsertClassifications(db, [outcome]);
    const renamed = await upsertClassifications(db, [{ ...outcome, name: 'Outcomes' }]);
    const [after] = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM classification WHERE slug = ${outcome.slug}
    `;

    expect(first.summary).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
    expect(again.summary).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
    expect(renamed.summary).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    expect(after).toEqual({ id: before?.id, name: 'Outcomes' });
    expect(renamed.orphaned).toEqual([
      { slug: 'population-no-file-lists', name: 'A population no file lists' },
    ]);
  });
});
