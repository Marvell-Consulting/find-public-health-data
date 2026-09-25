import { appEnvFields, parseEnv, z } from '@fphd/config';
import { PERIOD_TYPES, YEAR_TYPES } from '@fphd/utils/period-type';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Database } from './client.ts';
import { dbEnvFields, resolveDbTls } from './env.ts';
import {
  getPublishedIndicatorById,
  type IndicatorSearchFilters,
  listIndicatorFacets,
  resolvePublishedIndicatorId,
  searchIndicators,
} from './indicator-repository.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

// Seeded indicators given the period types the seed does not carry.
const WINTER_YEARS = 108;
const SURVEY_YEARS = 241;
const MONTHLY = 93995;
const MARCH_YEARS = 40501;
const LEAP_MARCH_YEARS = 90851;

let testDb: TestDatabase;
let owner: postgres.Sql;
let db: Database;

async function setPeriodType(
  shortId: number,
  periodTypeId: string,
  yearTypeId: string | null,
  yearEnd: [number, number] | null = null,
): Promise<void> {
  await owner`
    UPDATE indicator_version v
    SET period_type_id = ${periodTypeId}, year_type_id = ${yearTypeId},
        year_end_day = ${yearEnd?.[0] ?? null}, year_end_month = ${yearEnd?.[1] ?? null}
    FROM indicator i
    WHERE i.id = v.indicator_id AND i.short_id = ${shortId}
  `;
}

function filters(yearTypes: string[]): IndicatorSearchFilters {
  return {
    query: '',
    topics: [],
    indicatorTypes: [],
    riskFactors: [],
    frameworks: [],
    populations: [],
    inequalities: [],
    displayGroups: [],
    areaCodes: [],
    sources: [],
    valueTypes: [],
    yearTypes,
    limit: 200,
  };
}

async function shortIdsFound(yearTypes: string[]): Promise<number[]> {
  const { indicators } = await searchIndicators(db, filters(yearTypes));
  return indicators.map(({ shortId }) => shortId).sort((a, b) => a - b);
}

beforeAll(async () => {
  testDb = await createTestDatabase({ template: 'seeded' });
  owner = createOwnerClient(testDb.name);
  db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: testDb.name,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  });

  const { specifiedEndDate } = YEAR_TYPES;
  await setPeriodType(WINTER_YEARS, PERIOD_TYPES.years.id, specifiedEndDate.id, [31, 7]);
  await setPeriodType(SURVEY_YEARS, PERIOD_TYPES.quarters.id, specifiedEndDate.id, [15, 11]);
  await setPeriodType(MONTHLY, PERIOD_TYPES.months.id, null);
  await setPeriodType(MARCH_YEARS, PERIOD_TYPES.years.id, specifiedEndDate.id, [28, 2]);
  await setPeriodType(LEAP_MARCH_YEARS, PERIOD_TYPES.years.id, specifiedEndDate.id, [29, 2]);
});

afterAll(async () => {
  await db.$client.end();
  await owner.end();
  await testDb.drop();
});

describe('the public year type', () => {
  it('names the months of a year ending on the last day of one', async () => {
    const id = await resolvePublishedIndicatorId(db, WINTER_YEARS);

    expect((await getPublishedIndicatorById(db, id ?? ''))?.yearType).toBe('August to July');
  });

  it('names the date of a year ending within a month', async () => {
    const id = await resolvePublishedIndicatorId(db, SURVEY_YEARS);

    expect((await getPublishedIndicatorById(db, id ?? ''))?.yearType).toBe(
      'Year ending 15 November',
    );
  });

  it('is null for an indicator of months, which is still published', async () => {
    const id = await resolvePublishedIndicatorId(db, MONTHLY);
    const indicator = await getPublishedIndicatorById(db, id ?? '');

    expect(indicator?.shortId).toBe(MONTHLY);
    expect(indicator?.yearType).toBeNull();
  });

  it('offers each label once, in order, as a search filter', async () => {
    expect((await listIndicatorFacets(db)).yearTypes).toEqual([
      'Academic',
      'August to July',
      'Calendar',
      'Financial',
      'March to February',
      'Year ending 15 November',
    ]);
  });

  it('finds the indicators a label names', async () => {
    expect(await shortIdsFound(['August to July'])).toEqual([WINTER_YEARS]);
    expect(await shortIdsFound(['August to July', 'Year ending 15 November'])).toEqual([
      WINTER_YEARS,
      SURVEY_YEARS,
    ]);
    expect(await shortIdsFound(['Calendar'])).not.toContain(MONTHLY);
  });

  it('finds years ending 28 and 29 February by the one label', async () => {
    expect(await shortIdsFound(['March to February'])).toEqual([MARCH_YEARS, LEAP_MARCH_YEARS]);
  });

  it('finds nothing for a label no indicator has', async () => {
    expect(await shortIdsFound(['November-November'])).toEqual([]);
  });
});
