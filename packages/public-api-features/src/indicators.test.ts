import { createFakeRepositories, type FakeRepositoryOverrides } from '@fphd/db/testing';
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { indicatorsRouter } from './indicators.js';

const indicatorDetail = {
  fingertipsId: 108,
  name: 'Under 75 mortality rate from all causes',
  valueType: 'Directly standardised rate',
  unit: { name: 'per 100,000', label: 'per 100,000' },
  yearType: 'Calendar',
  frequency: 'Annual',
  polarity: 'RAG - Low is good',
  ciMethod: "Dobson & Byar's methods",
  ciConfidenceLevel: '95',
  comparatorMethod: null,
  dataUpdatedAt: '2026-04-20T16:25:18.000Z',
  definition: 'Directly age-standardised mortality rate for all deaths.',
  rationale: null,
  methodology: null,
  numeratorDefinition: null,
  denominatorDefinition: null,
  disclosureControl: null,
  caveats: null,
  notes: null,
  dataSource: { name: 'Office for National Statistics', url: null },
  numeratorSource: null,
  denominatorSource: null,
  areaTypes: [{ name: 'Counties & UAs (from Apr 2023)', areaCount: 153 }],
  topics: [{ slug: 'mortality-and-life-expectancy', title: 'Mortality and life expectancy' }],
  classifications: [
    { dimension: 'indicator_type', slug: 'indicator-type-outcome', name: 'Outcome' },
  ],
};

function createTestApp(overrides: FakeRepositoryOverrides['indicators'] = {}): Express {
  const app = express();

  app.use(indicatorsRouter(createFakeRepositories({ indicators: overrides }).indicators));

  return app;
}

describe('the public indicators surface', () => {
  it('404s data and range requests when the fingertips id resolves to nothing', async () => {
    const app = createTestApp({ resolveId: async () => undefined });

    expect((await request(app).get('/api/indicators/424242/data')).status).toBe(404);
    expect(
      (await request(app).get('/api/indicators/424242/range?displayGroup=Local+authorities'))
        .status,
    ).toBe(404);
  });
});

describe('GET /api/indicators', () => {
  it('searches indicators when q is given, trimming and bounding the query', async () => {
    const search = vi.fn().mockResolvedValue([]);
    const app = createTestApp({ search });

    await request(app).get('/api/indicators?q=%20%20diabetes%20%20');
    expect(search).toHaveBeenCalledWith('diabetes', 20);

    await request(app).get(`/api/indicators?q=${'a'.repeat(300)}`);
    expect(search).toHaveBeenLastCalledWith('a'.repeat(200), 20);
  });

  it('caps the search limit at 100 and ignores a malformed one', async () => {
    const search = vi.fn().mockResolvedValue([]);
    const app = createTestApp({ search });

    await request(app).get('/api/indicators?q=x&limit=500');
    expect(search).toHaveBeenCalledWith('x', 100);

    await request(app).get('/api/indicators?q=x&limit=nope');
    expect(search).toHaveBeenLastCalledWith('x', 20);
  });

  it('lists every indicator when q is empty', async () => {
    const listApproved = vi.fn().mockResolvedValue([]);
    const app = createTestApp({ listApproved });

    const response = await request(app).get('/api/indicators?q=%20%20');

    expect(response.status).toBe(200);
    expect(listApproved).toHaveBeenCalled();
  });
});

describe('GET /api/indicators/:fingertipsId', () => {
  it('finds an indicator by its fingertips id', async () => {
    const app = createTestApp({
      resolveId: async () => 'ind-1',
      findApprovedById: async () => indicatorDetail,
    });

    const response = await request(app).get('/api/indicators/108');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(indicatorDetail);
  });

  it('returns the standard not-found body for an unknown fingertips id', async () => {
    const app = createTestApp({ resolveId: async () => undefined });

    const response = await request(app).get('/api/indicators/424242');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('rejects a non-numeric indicator id without touching the repository', async () => {
    // No stub: if the route reached the repository, the fake would throw and this would 500.
    const response = await request(createTestApp()).get('/api/indicators/not-a-number');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });
});

describe('GET /api/indicators/:fingertipsId/data', () => {
  it('serves observations for an indicator, defaulting to England', async () => {
    const data = {
      areaCode: 'E92000001',
      areaName: 'England',
      observations: [
        {
          fromDate: '2023-01-01',
          toDate: '2023-12-31',
          value: 341.1,
          lowerCi95: 339,
          upperCi95: 343.2,
          lowerCi998: null,
          upperCi998: null,
          count: 130000,
          denominator: null,
          dimensions: [{ type: 'Age', value: '<75 yrs', dimensionClass: 'core', sortOrder: 1 }],
        },
      ],
    };
    const findObservations = vi.fn().mockResolvedValue(data);
    const app = createTestApp({ resolveId: async () => 'ind-1', findObservations });

    const response = await request(app).get('/api/indicators/108/data');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(data);
    expect(findObservations).toHaveBeenCalledWith('ind-1', 'E92000001');
  });

  it('passes an explicit area code through to the repository', async () => {
    const findObservations = vi
      .fn()
      .mockResolvedValue({ areaCode: 'E06000001', areaName: 'Hartlepool', observations: [] });
    const app = createTestApp({ resolveId: async () => 'ind-1', findObservations });

    const response = await request(app).get('/api/indicators/108/data?areaCode=E06000001');

    expect(response.status).toBe(200);
    expect(findObservations).toHaveBeenCalledWith('ind-1', 'E06000001');
  });

  it('answers with a list when several areas are asked for', async () => {
    const findObservations = vi.fn().mockImplementation(async (_id: string, areaCode: string) => ({
      areaCode,
      areaName: areaCode,
      observations: [],
    }));
    const app = createTestApp({ resolveId: async () => 'ind-1', findObservations });

    const response = await request(app).get(
      '/api/indicators/108/data?areaCode=E12000001&areaCode=E12000002',
    );

    expect(response.status).toBe(200);
    expect(response.body.map((entry: { areaCode: string }) => entry.areaCode)).toEqual([
      'E12000001',
      'E12000002',
    ]);
  });

  it('rejects a malformed area code without touching the repository', async () => {
    const response = await request(createTestApp()).get(
      '/api/indicators/108/data?areaCode=../nope',
    );

    expect(response.status).toBe(404);
  });

  it('returns not-found when none of the requested areas exist', async () => {
    const app = createTestApp({
      resolveId: async () => 'ind-1',
      findObservations: async () => undefined,
    });

    const response = await request(app).get('/api/indicators/424242/data');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });
});

describe('GET /api/indicators/:fingertipsId/range', () => {
  it('serves a per-segment range for the requested display group', async () => {
    const periods = [
      { fromDate: '2023-01-01', toDate: '2023-12-31', segment: 'Male', min: 1, max: 2 },
    ];
    const findObservationRange = vi.fn().mockResolvedValue(periods);
    const app = createTestApp({ resolveId: async () => 'ind-1', findObservationRange });

    const response = await request(app).get(
      '/api/indicators/241/range?displayGroup=Local%20authorities',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ periods });
    expect(findObservationRange).toHaveBeenCalledWith('ind-1', 'Local authorities');
  });

  it('rejects a range request without area types or with a non-numeric id', async () => {
    // No stub: if either route reached the repository, the fake would throw and 500.
    const app = createTestApp();

    expect((await request(app).get('/api/indicators/241/range')).status).toBe(404);
    expect(
      (await request(app).get('/api/indicators/nope/range?displayGroup=Local+authorities')).status,
    ).toBe(404);
  });
});
