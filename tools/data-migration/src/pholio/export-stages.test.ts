import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type mssql from 'mssql';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { readGzipCsv } from '../csv.ts';
import type { ObservationExportOptions, PholioExportOptions } from './context.ts';
import { exportDimensions } from './dimensions.ts';
import { exportGeography } from './geography.ts';
import { ageDimensionValueId, areaId, sexDimensionValueId } from './ids.ts';
import { exportIndicators } from './indicators.ts';
import { exportObservations, observationDimensions } from './observations.ts';
import { queryPholio, streamPholio } from './source.ts';

vi.mock('./source.ts', () => ({ queryPholio: vi.fn(), streamPholio: vi.fn() }));
let directory: string;
let options: PholioExportOptions;
beforeEach(async () => {
  vi.resetAllMocks();
  directory = await mkdtemp(join(tmpdir(), 'fphd-export-stages-'));
  options = {
    pool: {} as mssql.ConnectionPool,
    outDir: directory,
    excludedIndicators: [],
    indicatorSelection: { kind: 'approved', indicators: [108] },
  };
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
async function rows(table: string) {
  const out = [];
  for await (const row of readGzipCsv(join(directory, `${table}.csv.gz`))) out.push(row);
  const header = out.shift() ?? [];
  return out.map((row) => Object.fromEntries(header.map((column, index) => [column, row[index]])));
}

it('maps n-prefixed aliases and relationships to the same stable non-prefixed area', async () => {
  vi.mocked(queryPholio)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { AreaCode: 'nS1', AreaName: 'Alias', AreaTypeID: 1, IsCurrent: true },
      { AreaCode: 'S1', AreaName: 'Canonical', AreaTypeID: 1, IsCurrent: true },
      { AreaCode: 'W1', AreaName: 'Welsh', AreaTypeID: 1, IsCurrent: true },
    ])
    .mockResolvedValueOnce([{ ParentLevelGeographyCode: 'nS1', ChildLevelGeographyCode: 'W1' }]);
  const result = await exportGeography(options);
  expect(result.areaIdByPholioCode.get('nS1')).toBe(areaId('S1'));
  expect(result.areaIdByPholioCode.get('S1')).toBe(areaId('S1'));
  expect((await rows('area')).find((row) => row.code === 'S1')?.name).toBe('Canonical');
  expect((await rows('area_relationship'))[0]?.parent_area_id).toBe(String(areaId('S1')));
});

it('chooses age parents only from dimension values that were emitted', async () => {
  vi.mocked(queryPholio)
    .mockResolvedValueOnce([
      { AgeID: 1, Age: 'All ages', Sequence: 0, MinYears: null, MaxYears: null },
      { AgeID: 2, Age: 'Young', Sequence: 1, MinYears: 10, MaxYears: 20 },
      { AgeID: 3, Age: 'Broad', Sequence: 2, MinYears: 0, MaxYears: 65 },
      { AgeID: 209, Age: 'Compound', Sequence: 3, MinYears: 5, MaxYears: 25 },
    ])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  await exportDimensions(options);
  const values = await rows('dimension_value');
  expect(values.find((row) => row.id === String(ageDimensionValueId(2)))?.parent_id).toBe(
    String(ageDimensionValueId(3)),
  );
  expect(values.some((row) => row.id === String(ageDimensionValueId(209)))).toBe(false);
});

function sourceObservations(sourceRows: object[]) {
  vi.mocked(streamPholio).mockImplementation(async (_pool, query, consume) => {
    const sorted = [...sourceRows] as Record<string, unknown>[];
    sorted.sort((a, b) =>
      query.includes('ORDER BY c.IndicatorID')
        ? Number(a.IndicatorID) - Number(b.IndicatorID) || Number(a.uid) - Number(b.uid)
        : Number(a.uid) - Number(b.uid),
    );
    for (const row of sorted) await consume(row);
    return sorted.length;
  });
}
function observation(overrides: object = {}) {
  return {
    uid: 1,
    IndicatorID: 108,
    AreaCode: 'S1',
    Year: 2025,
    Month: -1,
    Quarter: -1,
    YearRange: 1,
    YearTypeID: 1,
    SexID: 4,
    AgeID: 1,
    CategoryTypeID: -1,
    CategoryID: -1,
    Value: 10,
    Count: 1,
    Denominator: 100,
    Denominator_2: null,
    LowerCI95: null,
    UpperCI95: null,
    LowerCI99_8: null,
    UpperCI99_8: null,
    ValueNoteId: 0,
    ...overrides,
  };
}
function observationOptions(): ObservationExportOptions {
  return {
    ...options,
    indicatorIds: new Set([108]),
    indicatorEnteredAt: new Map([[108, '2020-01-01T00:00:00.000Z']]),
    areaIdByPholioCode: new Map([['S1', areaId('S1')]]),
    noteTypeCategory: new Map(),
    dimensionValueIds: new Set(),
  };
}

it.each([
  [{ AreaCode: 'missing' }, /unknown area missing/],
  [{ ValueNoteId: 99 }, /unknown note type 99/],
  [{ AgeID: 88 }, /unknown dimension value/],
])(
  'refuses unmapped source data before writing observation files (%j)',
  async (override, message) => {
    sourceObservations([observation(override)]);
    await expect(exportObservations(observationOptions())).rejects.toThrow(message);
    expect(await readdir(directory)).toEqual([]);
  },
);

it('counts every intentional observation exclusion separately', async () => {
  sourceObservations([
    observation(),
    observation({ uid: 2, IndicatorID: 94204 }),
    observation({ uid: 3, IndicatorID: 109 }),
    observation({ uid: 4, ValueNoteId: 506 }),
    observation({ uid: 5, Value: -1, Count: -1, Denominator: -1 }),
    observation({ uid: 6, Year: 1899 }),
    observation({ uid: 7, IndicatorID: 110 }),
  ]);
  const input = observationOptions();
  input.indicatorSelection = { kind: 'approved', indicators: [108, 109] };
  input.excludedIndicators = [109];
  const result = await exportObservations(input);
  expect(result.observationExclusions).toEqual({
    test_indicator: 1,
    not_approved: 1,
    excluded_indicator: 1,
    note_506: 1,
    empty_observation: 1,
    year_before_1900: 1,
  });
  expect((await rows('observation')).length).toBe(1);
});

it('keeps the benchmark exclusion count limited to otherwise eligible observations', async () => {
  sourceObservations([
    observation(),
    observation({ uid: 2, IndicatorID: 109 }),
    observation({ uid: 3, IndicatorID: 109, ValueNoteId: 506 }),
    observation({ uid: 4, IndicatorID: 109, Year: 1899 }),
  ]);
  const input = observationOptions();
  input.indicatorSelection = { kind: 'approved', indicators: [108, 109] };
  input.excludedIndicators = [109];
  const result = await exportObservations(input);
  expect(result.observationExclusions.excluded_indicator).toBe(1);
  expect(result.observationExclusions.note_506).toBe(1);
  expect(result.observationExclusions.year_before_1900).toBe(1);
});

it('detects non-contiguous duplicate keys using the actual pre-flight', async () => {
  sourceObservations([
    observation(),
    observation({ uid: 2, IndicatorID: 109 }),
    observation({ uid: 5 }),
  ]);
  await expect(exportObservations(observationOptions())).rejects.toThrow(/CoreDataSet uids 1, 5/);
  expect(await readdir(directory)).toEqual([]);
});

it('uses the same compound dimensions in canonical keys and written bridges', async () => {
  const source = observation({ AgeID: 209, SexID: 4 });
  sourceObservations([source]);
  const input = observationOptions();
  input.dimensionValueIds = new Set(
    observationDimensions(source)
      .flat()
      .map((d) => d.valueId),
  );
  await exportObservations(input);
  const observations = await rows('observation');
  const dimensions = await rows('observation_dimension');
  expect(observations.length).toBe(2);
  for (const row of observations) {
    const ids = dimensions
      .filter((d) => d.observation_id === row.id)
      .map((d) => Number(d.dimension_value_id))
      .sort((a, b) => a - b);
    expect(row.dimension_key).toBe(ids.join(','));
  }
  expect(dimensions.some((row) => row.dimension_value_id === String(sexDimensionValueId(1)))).toBe(
    true,
  );
  expect(dimensions.some((row) => row.dimension_value_id === String(sexDimensionValueId(2)))).toBe(
    true,
  );
});

function indicatorQueries(unitName = 'No unit') {
  vi.mocked(queryPholio)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 1, name: 'Not applicable' }])
    .mockResolvedValueOnce([{ id: 1, name: 'Annual' }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(
      [108, 109].map((IndicatorID) => ({
        IndicatorID,
        Name: `Indicator ${IndicatorID}`,
        ValueTypeName: 'Count',
        UnitName: unitName,
        YearTypeName: 'Calendar',
        CIMethodID: null,
        EnteredAt: new Date('2020-01-01T00:00:00Z'),
      })),
    )
    .mockResolvedValueOnce([
      {
        IndicatorID: 108,
        Definition: 'aged <16 and >64, <b>high</b>',
        Rationale: null,
        Methodology: null,
        NumeratorDefinition: null,
        DenominatorDefinition: null,
        DataSourceID: null,
        NumeratorSourceID: null,
        DenominatorSourceID: null,
        DisclosureControl: null,
        Caveats: null,
        Notes: null,
      },
    ]);
}
it('exports only the approved indicators and uses plain text without damaging inequalities', async () => {
  indicatorQueries();
  const result = await exportIndicators(options);
  expect(result.indicatorIds).toEqual(new Set([108]));
  expect(result.excludedNonApprovedIndicators).toBe(1);
  expect((await rows('indicator_version'))[0]?.definition).toBe('aged <16 and >64, high');
});
it('refuses an approved indicator absent from the source', async () => {
  indicatorQueries();
  options.indicatorSelection = { kind: 'approved', indicators: [110] };
  await expect(exportIndicators(options)).rejects.toThrow(/110/);
  expect(await readdir(directory)).toEqual([]);
});

it.each(['', ' '])(
  'refuses an unmappable approved unit before writing tables (%j)',
  async (unitName) => {
    indicatorQueries(unitName);
    await expect(exportIndicators(options)).rejects.toThrow(/Cannot translate units/);
    expect(await readdir(directory)).toEqual([]);
  },
);
