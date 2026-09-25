import { UNITS, VALUE_TYPES } from '@fphd/utils/value-type-and-unit';
import type postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { migrateToLatest } from './migrations.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, migrateBefore, type TestDatabase } from './testing.ts';

const MIGRATION = '0026_value-type-and-units';

// Each Fingertips value type the service keeps under another name, and what it becomes.
const VALUE_TYPE_TRANSLATIONS: [string, string][] = [
  ['Proportion', VALUE_TYPES.proportion.id],
  ['Directly standardised rate', VALUE_TYPES.directlyStandardisedRate.id],
  ['Slope Index of Inequality', VALUE_TYPES.slopeIndexOfInequality.id],
  ['Number', VALUE_TYPES.count.id],
  ['Rate ratio', VALUE_TYPES.ratio.id],
];

// Each Fingertips unit, and the unit and other unit it becomes.
const UNIT_TRANSLATIONS: [string, string, string | null][] = [
  ['Percent', UNITS.percent.id, null],
  ['per 100,000', UNITS.per100000.id, null],
  ['Minutes', UNITS.minutes.id, null],
  ['Days', UNITS.days.id, null],
  ['Years', UNITS.years.id, null],
  ['£ per capita', UNITS.poundsPerCapita.id, null],
  ['No unit', UNITS.noUnit.id, null],
  ['per 1,000 live births', UNITS.other.id, 'per 1,000 live births'],
  ['per 1,000, per day ', UNITS.other.id, 'per 1,000, per day'],
  ['Percentage points', UNITS.other.id, 'Percentage points'],
];

interface LegacyVersion {
  valueType?: string;
  unit?: string;
}

/** A database migrated to just before this one, holding a version for each legacy answer. */
async function withLegacyVersions(
  versions: LegacyVersion[],
): Promise<[TestDatabase, postgres.Sql]> {
  const testDb = await createTestDatabase({ template: 'unmigrated' });
  const sql = createOwnerClient(testDb.name);
  await migrateBefore(sql, MIGRATION);

  for (const [index, { valueType = null, unit = null }] of versions.entries()) {
    await sql`
      WITH
        created AS (INSERT INTO indicator (short_id) VALUES (${index + 1}) RETURNING id),
        value_type AS (
          INSERT INTO value_type (name) SELECT ${valueType}
          WHERE ${valueType}::text IS NOT NULL
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        ),
        unit AS (
          INSERT INTO unit (name, label) SELECT ${unit}, ${unit}
          WHERE ${unit}::text IS NOT NULL
          RETURNING id
        )
      INSERT INTO indicator_version
        (indicator_id, name, slug, value_type_id, unit_id, created_by, updated_by)
      SELECT created.id, ${`Indicator ${index + 1}`}, ${`indicator-${index + 1}`},
             (SELECT id FROM value_type), (SELECT id FROM unit), 'migration-test', 'migration-test'
      FROM created
    `;
  }

  return [testDb, sql];
}

async function versionOf(sql: postgres.Sql, shortId: number) {
  const [version] = await sql`
    SELECT v.value_type_id, v.unit_id, v.unit_other
    FROM indicator_version v JOIN indicator i ON i.id = v.indicator_id
    WHERE i.short_id = ${shortId}
  `;
  return version;
}

// The version with neither answered, which the constraint cases update.
const BLANK = VALUE_TYPE_TRANSLATIONS.length + UNIT_TRANSLATIONS.length + 1;

describe(`migration ${MIGRATION}`, () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  function updateBlank(columns: Record<string, string | null>) {
    return sql`
      UPDATE indicator_version v SET ${sql(columns)}
      FROM indicator i
      WHERE i.id = v.indicator_id AND i.short_id = ${BLANK}
    `;
  }

  beforeAll(async () => {
    [testDb, sql] = await withLegacyVersions([
      ...VALUE_TYPE_TRANSLATIONS.map(([valueType]) => ({ valueType })),
      ...UNIT_TRANSLATIONS.map(([unit]) => ({ unit })),
      {},
    ]);
    await migrateToLatest(sql);
  });

  afterAll(async () => {
    await sql?.end();
    await testDb?.drop();
  });

  it.each(VALUE_TYPE_TRANSLATIONS.map(([name, id], index) => [name, index + 1, id]))(
    'translates the value type %s',
    async (_, shortId, id) => {
      expect(await versionOf(sql, shortId)).toMatchObject({ value_type_id: id });
    },
  );

  it.each(
    UNIT_TRANSLATIONS.map(([name, id, other], index) => [
      name,
      VALUE_TYPE_TRANSLATIONS.length + index + 1,
      id,
      other,
    ]),
  )('translates the unit %s', async (_, shortId, id, other) => {
    expect(await versionOf(sql, shortId)).toMatchObject({ unit_id: id, unit_other: other });
  });

  it('leaves a version with neither unanswered', async () => {
    expect(await versionOf(sql, BLANK)).toEqual({
      value_type_id: null,
      unit_id: null,
      unit_other: null,
    });
  });

  it("holds the service's value types and units and no Fingertips one", async () => {
    const valueTypes = await sql<{ id: string; name: string }[]>`SELECT id, name FROM value_type`;
    const units = await sql<{ id: string; name: string }[]>`SELECT id, name FROM unit`;
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

    expect([...valueTypes].sort(byName)).toEqual(Object.values(VALUE_TYPES).sort(byName));
    expect([...units].sort(byName)).toEqual(Object.values(UNITS).sort(byName));
  });

  describe('constraints', () => {
    beforeEach(async () => {
      await updateBlank({
        value_type_id: null,
        unit_id: null,
        unit_other: null,
        standard_population: null,
        standard_population_detail: null,
      });
    });

    it.each<[string, Record<string, string | null>, string]>([
      [
        'an other unit with no name',
        { unit_id: UNITS.other.id, unit_other: null },
        'unit_other_check',
      ],
      [
        'a named unit beside one in the list',
        { unit_id: UNITS.percent.id, unit_other: 'people' },
        'unit_other_check',
      ],
      [
        'an other unit over 100 characters',
        { unit_id: UNITS.other.id, unit_other: 'x'.repeat(101) },
        'unit_other_length_check',
      ],
      [
        'a standard population on a crude rate',
        { value_type_id: VALUE_TYPES.crudeRate.id, standard_population: 'esp-2013' },
        'standard_population_value_type_check',
      ],
      [
        'an unknown standard population',
        { value_type_id: VALUE_TYPES.directlyStandardisedRate.id, standard_population: '1976' },
        'standard_population_check',
      ],
      [
        'an other standard population with no detail',
        { value_type_id: VALUE_TYPES.directlyStandardisedRate.id, standard_population: 'other' },
        'standard_population_other_check',
      ],
      [
        'a detail beside the 2013 European Standard Population',
        {
          value_type_id: VALUE_TYPES.directlyStandardisedRate.id,
          standard_population: 'esp-2013',
          standard_population_detail: 'England 2021',
        },
        'standard_population_detail_check',
      ],
      [
        'a population detail on a proportion',
        { value_type_id: VALUE_TYPES.proportion.id, standard_population_detail: 'England 2021' },
        'standard_population_detail_check',
      ],
    ])('refuses %s', async (_, columns, constraint) => {
      await expect(updateBlank(columns)).rejects.toMatchObject({
        code: '23514',
        constraint_name: `indicator_version_${constraint}`,
      });
    });

    it.each<[string, Record<string, string | null>]>([
      ['an other unit with its name', { unit_id: UNITS.other.id, unit_other: 'people' }],
      [
        'a directly standardised rate with an other population',
        {
          value_type_id: VALUE_TYPES.directlyStandardisedRate.id,
          standard_population: 'other',
          standard_population_detail: 'England 2021',
        },
      ],
      [
        'an indirectly standardised ratio with its reference population',
        {
          value_type_id: VALUE_TYPES.indirectlyStandardisedRatio.id,
          standard_population_detail: 'England 2021',
        },
      ],
    ])('takes %s', async (_, columns) => {
      await expect(updateBlank(columns)).resolves.toHaveProperty('count', 1);
    });
  });
});

describe.each<[string, LegacyVersion]>([
  ['a value type', { valueType: 'Months life lost' }],
  ['a placeholder unit', { unit: 'Unknown unit 54' }],
])(`migration ${MIGRATION} over %s it cannot translate`, (_, version) => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    [testDb, sql] = await withLegacyVersions([{ valueType: 'Count', unit: 'Percent' }, version]);
  });

  afterAll(async () => {
    await sql?.end();
    await testDb?.drop();
  });

  it('stops rather than drop the answer', async () => {
    await expect(migrateToLatest(sql)).rejects.toThrow(/no value to translate it to/);
  });
});
