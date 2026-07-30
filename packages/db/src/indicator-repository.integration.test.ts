import { parseEnv, z } from '@fphd/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listAreasByType } from './area-repository.js';
import { createDb, type Database } from './client.js';
import { dbEnvFields } from './env.js';
import {
  getApprovedIndicatorByFingertipsId,
  getIndicatorObservations,
  listApprovedIndicators,
} from './indicator-repository.js';
import { createTestDatabase, type TestDatabase } from './testing.js';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

function ownerConnection(database: string) {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  };
}

// Under 75 mortality rate from all causes: a seeded indicator with full metadata, both
// single-year and rolling periods, and sex/age/deprivation breakdowns.
const MORTALITY_UNDER_75 = 108;
const ENGLAND = 'E92000001';

let testDb: TestDatabase;
let db: Database;

beforeAll(async () => {
  testDb = await createTestDatabase({ template: 'seeded' });
  db = createDb(ownerConnection(testDb.name));
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

describe('listApprovedIndicators', () => {
  it('returns the seeded indicators in name order', async () => {
    const indicators = await listApprovedIndicators(db);

    expect(indicators).toHaveLength(10);
    const names = indicators.map(({ name }) => name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(indicators.every(({ status }) => status === 'approved')).toBe(true);
  });
});

describe('getApprovedIndicatorByFingertipsId', () => {
  it('resolves the lookups, metadata and available area types in one result', async () => {
    const indicator = await getApprovedIndicatorByFingertipsId(db, MORTALITY_UNDER_75);

    expect(indicator).toMatchObject({
      fingertipsId: MORTALITY_UNDER_75,
      name: expect.stringContaining('Under 75 mortality rate'),
      valueType: expect.any(String),
      unit: { name: expect.any(String), label: expect.any(String) },
      yearType: expect.any(String),
      frequency: expect.any(String),
      polarity: expect.any(String),
      definition: expect.any(String),
    });
    expect(indicator?.areaTypes.length).toBeGreaterThan(0);
    // Ordered by name so the filter pane does not have to sort what it renders.
    const areaTypeNames = indicator?.areaTypes.map(({ name }) => name) ?? [];
    expect(areaTypeNames).toEqual([...areaTypeNames].sort((a, b) => a.localeCompare(b)));
  });

  it('returns undefined for a fingertips id no indicator carries', async () => {
    expect(await getApprovedIndicatorByFingertipsId(db, 424242)).toBeUndefined();
  });
});

describe('getIndicatorObservations', () => {
  it('returns every published observation for the area with its dimension labels', async () => {
    const data = await getIndicatorObservations(db, MORTALITY_UNDER_75, ENGLAND);

    expect(data?.areaName).toBe('England');
    expect(data?.observations.length).toBeGreaterThan(1000);

    // Ordered by period so a trend series needs no further sorting.
    const fromDates = data?.observations.map(({ fromDate }) => fromDate) ?? [];
    expect(fromDates).toEqual([...fromDates].sort());

    // The least-disaggregated England series for this indicator carries one Age dimension.
    const singleDimension = data?.observations.filter(({ dimensions }) => dimensions.length === 1);
    expect(singleDimension).toHaveLength(18);
    expect(singleDimension?.[0]?.dimensions[0]).toMatchObject({
      type: 'Age',
      value: '<75 yrs',
      dimensionClass: 'core',
    });
  });

  it('returns an empty observation list when the area holds no data for the indicator', async () => {
    // 93622 is seeded for deprivation-within-area only, so lower-tier authorities are empty.
    const [lowerTier] = await listAreasByType(db, 'LA unchanged');
    expect(lowerTier).toBeTruthy();

    const data = await getIndicatorObservations(db, 93622, lowerTier?.code ?? '');

    expect(data?.observations).toEqual([]);
    expect(data?.areaName).toBe(lowerTier?.name);
  });

  it('returns undefined when the indicator or the area does not exist', async () => {
    expect(await getIndicatorObservations(db, 424242, ENGLAND)).toBeUndefined();
    expect(await getIndicatorObservations(db, MORTALITY_UNDER_75, 'E00000000')).toBeUndefined();
  });
});

describe('listAreasByType', () => {
  it('returns the current areas of the type in name order', async () => {
    const regions = await listAreasByType(db, 'Regions (statistical)');

    expect(regions).toHaveLength(9);
    const names = regions.map(({ name }) => name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(regions.every(({ code }) => /^E\d{8}$/.test(code))).toBe(true);
  });

  it('returns nothing for an area type that does not exist', async () => {
    expect(await listAreasByType(db, 'No Such Area Type')).toEqual([]);
  });
});
