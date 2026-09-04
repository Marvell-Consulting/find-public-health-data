import { appEnvFields, parseEnv, z } from '@fphd/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  listAreaParents,
  listAreasByCodes,
  listAreasByGroup,
  listAreasByType,
  listDisplayGroups,
  searchAreas,
} from './area-repository.js';
import { createDb, type Database } from './client.js';
import { dbEnvFields, resolveDbTls } from './env.js';
import {
  getApprovedIndicatorByFingertipsId,
  getIndicatorObservations,
  getObservationRange,
  listApprovedIndicators,
  searchApprovedIndicators,
} from './indicator-repository.js';
import { createTestDatabase, type TestDatabase } from './testing.js';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
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
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  };
}

// Under 75 mortality rate from all causes: a seeded indicator with full metadata, both
// single-year and rolling periods, and sex/age/deprivation breakdowns.
const MORTALITY_UNDER_75 = 108;
const DIABETES_QOF_PREVALENCE = 241;
const LIFE_EXPECTANCY_AT_BIRTH = 90366;
const ENGLAND = 'E92000001';
const CORNWALL = 'E06000052';

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

    expect(indicators).toHaveLength(13);
    const names = indicators.map(({ name }) => name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(indicators.every(({ status }) => status === 'approved')).toBe(true);
  });
});

describe('searchApprovedIndicators', () => {
  it('matches case-insensitively anywhere in the name', async () => {
    const results = await searchApprovedIndicators(db, 'DIABETES', 20);

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every(({ name }) => name.toLowerCase().includes('diabetes'))).toBe(true);
  });

  it('ranks a match earlier in the name above a later one', async () => {
    const results = await searchApprovedIndicators(db, 'diabetes', 20);

    expect(results[0]?.name).toBe('Diabetes: QOF prevalence');
  });

  it('respects the limit', async () => {
    expect(await searchApprovedIndicators(db, 'a', 3)).toHaveLength(3);
  });

  it('treats LIKE syntax in the query as literal text', async () => {
    expect(await searchApprovedIndicators(db, '%', 20)).toEqual([]);
    expect(await searchApprovedIndicators(db, '_', 20)).toEqual([]);
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
    // Topic membership and the source publication date come from the seed import.
    expect(indicator?.dataUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(indicator?.topics.map(({ title }) => title)).toContain('Mortality and life expectancy');

    expect(indicator?.areaTypes.length).toBeGreaterThan(0);
    // Ordered by name so the filter pane does not have to sort what it renders.
    const areaTypeNames = indicator?.areaTypes.map(({ name }) => name) ?? [];
    expect(areaTypeNames).toEqual([...areaTypeNames].sort((a, b) => a.localeCompare(b)));
  });

  it('returns undefined for a fingertips id no indicator carries', async () => {
    expect(await getApprovedIndicatorByFingertipsId(db, 424242)).toBeUndefined();
  });

  it('includes the prototype diabetes indicator with its high-fidelity geography coverage', async () => {
    const indicator = await getApprovedIndicatorByFingertipsId(db, DIABETES_QOF_PREVALENCE);

    expect(indicator).toMatchObject({
      fingertipsId: DIABETES_QOF_PREVALENCE,
      name: 'Diabetes: QOF prevalence',
      valueType: 'Proportion',
      unit: { label: '%' },
    });
    expect(indicator?.areaTypes.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['England', 'GPs', 'ICBs', 'NHS regions', 'Regions (statistical)']),
    );
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

  it('returns the published Cornwall trend for the prototype diabetes indicator', async () => {
    const data = await getIndicatorObservations(db, DIABETES_QOF_PREVALENCE, CORNWALL);

    expect(data?.areaName).toBe('Cornwall');
    expect(data?.observations).toHaveLength(13);
    expect(data?.observations[0]).toMatchObject({
      fromDate: '2012-04-01',
      toDate: '2013-03-31',
    });
    expect(data?.observations.at(-1)).toMatchObject({
      fromDate: '2024-04-01',
      toDate: '2025-03-31',
    });
  });
});

describe('getObservationRange', () => {
  it('brackets each period of the trend series across every area of the level', async () => {
    const [range, cornwall] = await Promise.all([
      getObservationRange(db, DIABETES_QOF_PREVALENCE, 'Local authorities'),
      getIndicatorObservations(db, DIABETES_QOF_PREVALENCE, CORNWALL),
    ]);

    expect(range.length).toBeGreaterThan(0);
    for (const period of range) {
      expect(period.min).toBeLessThanOrEqual(period.max);
      const observation = cornwall?.observations.find(
        ({ fromDate, toDate, value }) =>
          fromDate === period.fromDate && toDate === period.toDate && value !== null,
      );
      if (observation?.value != null) {
        expect(observation.value).toBeGreaterThanOrEqual(period.min);
        expect(observation.value).toBeLessThanOrEqual(period.max);
      }
    }
  });

  it('returns an empty range for an unknown group or an unknown indicator', async () => {
    expect(await getObservationRange(db, DIABETES_QOF_PREVALENCE, 'No Such Level')).toEqual([]);
    expect(await getObservationRange(db, 424242, 'Local authorities')).toEqual([]);
  });

  it('returns one range per segment for an always-sexed indicator', async () => {
    const range = await getObservationRange(db, LIFE_EXPECTANCY_AT_BIRTH, 'Local authorities');

    const segments = new Set(range.map(({ segment }) => segment));
    expect(segments.has('Male')).toBe(true);
    expect(segments.has('Female')).toBe(true);
    for (const period of range) {
      expect(period.min).toBeLessThanOrEqual(period.max);
    }
  });
});

describe('listAreaParents', () => {
  it('maps each area to its parent of the requested type', async () => {
    const parents = await listAreaParents(db, [CORNWALL], 'Regions (statistical)');

    expect(parents).toEqual([
      {
        code: CORNWALL,
        parentCode: 'E12000009',
        parentName: 'South West',
      },
    ]);
  });

  it('returns nothing for empty input or a parent type the areas do not roll up to', async () => {
    expect(await listAreaParents(db, [], 'Regions (statistical)')).toEqual([]);
    expect(await listAreaParents(db, [CORNWALL], 'No Such Type')).toEqual([]);
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

describe('listDisplayGroups', () => {
  it('returns the user-facing levels in display order', async () => {
    expect(await listDisplayGroups(db)).toEqual([
      'Local authorities',
      'Statistical regions',
      'NHS regions',
      'Integrated care boards',
      'Middle-layer super output areas',
      'GP practices',
    ]);
  });
});

describe('listAreasByGroup', () => {
  it('returns every current area across the group types, bare-named and ordered', async () => {
    const regions = await listAreasByGroup(db, 'Statistical regions');

    expect(regions.map(({ name }) => name)).toEqual([
      'East Midlands',
      'East of England',
      'London',
      'North East',
      'North West',
      'South East',
      'South West',
      'West Midlands',
      'Yorkshire and the Humber',
    ]);
  });

  it('returns nothing for an unknown group', async () => {
    expect(await listAreasByGroup(db, 'No Such Level')).toEqual([]);
  });
});

describe('listAreasByCodes', () => {
  it('resolves each code to its current name and area type', async () => {
    expect(await listAreasByCodes(db, [CORNWALL, ENGLAND])).toEqual([
      {
        code: CORNWALL,
        name: 'Cornwall',
        areaType: 'UA unchanged',
        displayGroup: 'Local authorities',
      },
      { code: ENGLAND, name: 'England', areaType: 'England', displayGroup: null },
    ]);
  });

  it('returns nothing for empty input, silently skipping unknown codes', async () => {
    expect(await listAreasByCodes(db, [])).toEqual([]);
    expect(await listAreasByCodes(db, ['X99999999'])).toEqual([]);
  });
});

describe('searchAreas', () => {
  it('matches by name or exact code across displayed types, carrying the display group', async () => {
    const cornwall = {
      code: CORNWALL,
      name: 'Cornwall',
      areaType: 'UA unchanged',
      displayGroup: 'Local authorities',
    };
    const results = await searchAreas(db, 'cornwall', 10);

    // The council ranks above the ICB and practices that contain the same word.
    expect(results[0]).toEqual(cornwall);
    expect(results.every(({ name }) => name.toLowerCase().includes('cornwall'))).toBe(true);
    expect(results.every(({ displayGroup }) => displayGroup !== null)).toBe(true);
    expect((await searchAreas(db, 'e06000052', 10))[0]).toEqual(cornwall);
  });

  it('never surfaces an area whose type has no display group', async () => {
    expect((await searchAreas(db, 'england', 20)).every(({ code }) => code !== ENGLAND)).toBe(true);
  });

  it('ranks earlier matches first and applies the limit', async () => {
    const names = (await searchAreas(db, 'west', 3)).map(({ name }) => name);

    expect(names).toHaveLength(3);
    expect(names.every((name) => name.startsWith('West'))).toBe(true);
  });

  it('treats pattern characters literally instead of as wildcards', async () => {
    expect(await searchAreas(db, '%', 10)).toEqual([]);
    expect(await searchAreas(db, '____', 10)).toEqual([]);
  });
});
