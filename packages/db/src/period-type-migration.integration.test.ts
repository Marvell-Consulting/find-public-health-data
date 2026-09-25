import { PERIOD_TYPES, YEAR_TYPES } from '@fphd/utils/period-type';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrateToLatest } from './migrations.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, migrateBefore, type TestDatabase } from './testing.ts';

const MIGRATION = '0025_period-type';

const { months, quarters, years } = PERIOD_TYPES;
const { academic, calendar, financial, rolling, specifiedEndDate } = YEAR_TYPES;

// Each Fingertips year type, and the period type, year type and year end it becomes.
const TRANSLATIONS: [string, string, string, number | null, number | null][] = [
  ['Calendar', years.id, calendar.id, null, null],
  ['Financial', years.id, financial.id, null, null],
  ['Academic', years.id, academic.id, null, null],
  ['August-July', years.id, specifiedEndDate.id, 31, 7],
  ['July-June', years.id, specifiedEndDate.id, 30, 6],
  ['October-September', years.id, specifiedEndDate.id, 30, 9],
  ['March-February', years.id, specifiedEndDate.id, 28, 2],
  ['November-November', years.id, specifiedEndDate.id, 15, 11],
  ['September-January', years.id, specifiedEndDate.id, 31, 1],
  ['September-February', years.id, specifiedEndDate.id, 28, 2],
  ['Calendar rolling year - monthly', years.id, rolling.id, null, null],
  ['Calendar rolling year - quarterly', years.id, rolling.id, null, null],
  ['Financial rolling year - monthly', years.id, rolling.id, null, null],
  ['Financial rolling year - quarterly', years.id, rolling.id, null, null],
  ['Financial single year cumulative quarters', quarters.id, financial.id, null, null],
  ['Financial multi year cumulative quarters', quarters.id, financial.id, null, null],
  ['Financial year end point', years.id, specifiedEndDate.id, 31, 3],
];

/** A database migrated to just before this one, holding a version of each Fingertips name. */
async function withLegacyYearTypes(names: string[]): Promise<[TestDatabase, postgres.Sql]> {
  const testDb = await createTestDatabase({ template: 'unmigrated' });
  const sql = createOwnerClient(testDb.name);
  await migrateBefore(sql, MIGRATION);

  for (const [index, name] of [...names, null].entries()) {
    await sql`
      WITH
        created AS (INSERT INTO indicator (short_id) VALUES (${index + 1}) RETURNING id),
        year_type AS (
          INSERT INTO year_type (name) SELECT ${name} WHERE ${name}::text IS NOT NULL RETURNING id
        )
      INSERT INTO indicator_version (indicator_id, name, slug, year_type_id, created_by, updated_by)
      SELECT created.id, ${`Indicator ${index + 1}`}, ${`indicator-${index + 1}`},
             (SELECT id FROM year_type), 'migration-test', 'migration-test'
      FROM created
    `;
  }

  return [testDb, sql];
}

describe(`migration ${MIGRATION}`, () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    [testDb, sql] = await withLegacyYearTypes(TRANSLATIONS.map(([name]) => name));
    await migrateToLatest(sql);
  });

  afterAll(async () => {
    await sql?.end();
    await testDb?.drop();
  });

  it.each(TRANSLATIONS.map((translation, index) => [translation[0], index + 1, translation]))(
    'translates %s',
    async (_, shortId, [, periodTypeId, yearTypeId, yearEndDay, yearEndMonth]) => {
      const [version] = await sql`
        SELECT v.period_type_id, v.year_type_id, v.year_end_day, v.year_end_month
        FROM indicator_version v JOIN indicator i ON i.id = v.indicator_id
        WHERE i.short_id = ${shortId}
      `;

      expect(version).toEqual({
        period_type_id: periodTypeId,
        year_type_id: yearTypeId,
        year_end_day: yearEndDay,
        year_end_month: yearEndMonth,
      });
    },
  );

  it('leaves a version with no year type unanswered', async () => {
    const [version] = await sql`
      SELECT v.period_type_id, v.year_type_id
      FROM indicator_version v JOIN indicator i ON i.id = v.indicator_id
      WHERE i.short_id = ${TRANSLATIONS.length + 1}
    `;

    expect(version).toEqual({ period_type_id: null, year_type_id: null });
  });

  it("holds the service's period and year types and no Fingertips one", async () => {
    const periodTypes = await sql`SELECT id, name FROM period_type ORDER BY name`;
    const yearTypes = await sql`SELECT id, name FROM year_type ORDER BY name`;
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

    expect(periodTypes).toEqual([months, quarters, years].sort(byName));
    expect(yearTypes).toEqual(
      [academic, calendar, specifiedEndDate, financial, rolling].sort(byName),
    );
  });

  it.each<[string, { period: string; year: string | null; day?: number; month?: number }]>([
    ['a year type on months', { period: months.id, year: calendar.id }],
    ['no year type on years', { period: years.id, year: null }],
    ['a year end on a calendar year', { period: years.id, year: calendar.id, day: 31, month: 7 }],
    ['no year end on a year ending on a date', { period: years.id, year: specifiedEndDate.id }],
    ['half a year end', { period: years.id, year: specifiedEndDate.id, day: 31 }],
    ['31 February', { period: years.id, year: specifiedEndDate.id, day: 31, month: 2 }],
    ['month 13', { period: years.id, year: specifiedEndDate.id, day: 1, month: 13 }],
  ])('refuses %s', async (_, { period, year, day = null, month = null }) => {
    await expect(sql`
      UPDATE indicator_version SET
        period_type_id = ${period}, year_type_id = ${year},
        year_end_day = ${day}, year_end_month = ${month}
      WHERE id = (SELECT id FROM indicator_version LIMIT 1)
    `).rejects.toMatchObject({ code: '23514' });
  });

  it('takes 29 February', async () => {
    await expect(sql`
      UPDATE indicator_version SET
        period_type_id = ${years.id}, year_type_id = ${specifiedEndDate.id},
        year_end_day = 29, year_end_month = 2
      WHERE id = (SELECT id FROM indicator_version LIMIT 1)
    `).resolves.toBeDefined();
  });
});

describe(`migration ${MIGRATION} over a year type it cannot translate`, () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    [testDb, sql] = await withLegacyYearTypes(['Calendar', 'Fortnightly']);
  });

  afterAll(async () => {
    await sql?.end();
    await testDb?.drop();
  });

  it('stops rather than drop the answer', async () => {
    await expect(migrateToLatest(sql)).rejects.toThrow(/no value to translate it to/);
  });
});
