import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IMPORTED_INDICATOR_TEAM_ID, SYSTEM_USER_IDS } from './schema/index.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { seedTaxonomy } from './seed-taxonomy.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

let database: TestDatabase;
let sql: ReturnType<typeof createOwnerClient>;
beforeAll(async () => {
  database = await createTestDatabase({ template: 'seeded' });
  sql = createOwnerClient(database.name);
});
afterAll(async () => {
  await sql.end();
  await database.drop();
});

async function extraIndicator(shortId: number, actor: string): Promise<string> {
  const [identity] = await sql<
    { id: string }[]
  >`INSERT INTO indicator (short_id, team_id) VALUES (${shortId}, ${IMPORTED_INDICATOR_TEAM_ID}) RETURNING id`;
  const [version] = await sql<
    { id: string }[]
  >`INSERT INTO indicator_version (indicator_id, status, published_at, name, slug, created_by, updated_by) VALUES (${identity?.id ?? ''}, 'published', now(), ${`Taxonomy seed ${shortId}`}, ${`taxonomy-seed-${shortId}`}, ${actor}, ${actor}) RETURNING id`;
  await sql`INSERT INTO indicator_version_topic (indicator_version_id, topic_id) SELECT ${version?.id ?? ''}, id FROM topic WHERE slug = 'cancer'`;
  return version?.id ?? '';
}

describe('seeding the draft taxonomy without reloading data', () => {
  it('clears old guesses while retaining excluded indicators and all observations', async () => {
    const excludedVersion = await extraIndicator(276, SYSTEM_USER_IDS.pholioMigration);
    await sql`INSERT INTO indicator_version_topic (indicator_version_id, topic_id) SELECT cpv.id, t.id FROM indicator i JOIN current_published_version cpv ON cpv.indicator_id = i.id CROSS JOIN topic t WHERE i.short_id = 92708 AND t.slug = 'cancer'`;
    const [before] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM observation`;
    const result = await sql.begin((tx) => seedTaxonomy(tx));
    expect(result.unplacedIndicators).toEqual([276]);
    expect(result.relationships.links).toBe(14);
    expect(await sql`SELECT id FROM indicator_version WHERE id = ${excludedVersion}`).toHaveLength(
      1,
    );
    expect(
      await sql`SELECT topic_id FROM indicator_version_topic WHERE indicator_version_id = ${excludedVersion}`,
    ).toEqual([]);
    const [after] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM observation`;
    expect(after?.count).toBe(before?.count);
    expect(after?.count).toBeGreaterThan(0);
  });

  it('preserves publications owned by another writer', async () => {
    const protectedVersion = await extraIndicator(99997, SYSTEM_USER_IDS.coreDataImport);
    const result = await sql.begin((tx) => seedTaxonomy(tx));
    expect(result.publisherIndicatorsSkipped).toEqual([99997]);
    expect(
      await sql`SELECT topic_id FROM indicator_version_topic WHERE indicator_version_id = ${protectedVersion}`,
    ).toHaveLength(1);
  });

  it('stops before changing memberships when a source publication has a working draft', async () => {
    await sql`INSERT INTO indicator_version (indicator_id, name, slug, created_by, updated_by) SELECT id, 'Working taxonomy draft', 'working-taxonomy-draft', ${SYSTEM_USER_IDS.coreDataImport}, ${SYSTEM_USER_IDS.coreDataImport} FROM indicator WHERE short_id = 108`;
    const before =
      await sql`SELECT * FROM indicator_version_topic ORDER BY indicator_version_id, topic_id`;
    await expect(sql.begin((tx) => seedTaxonomy(tx))).rejects.toThrow(
      'Working drafts protect imported indicators: 108',
    );
    expect(
      await sql`SELECT * FROM indicator_version_topic ORDER BY indicator_version_id, topic_id`,
    ).toEqual(before);
  });
});
