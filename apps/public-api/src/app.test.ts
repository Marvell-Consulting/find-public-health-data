import { createFakeRepositories } from '@fphd/db/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';

const topicA = {
  id: '00000000-0000-7000-8000-000000000001',
  slug: 'topic-a',
  title: 'Topic A',
  description: 'All about topic A.',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

const topicB = {
  id: '00000000-0000-7000-8000-000000000002',
  slug: 'topic-b',
  title: 'Topic B',
  description: 'All about topic B.',
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
  updatedAt: new Date('2024-02-02T00:00:00.000Z'),
};

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

describe('public API', () => {
  it('reports its health', async () => {
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/livez',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'public-api' });
  });

  it('does not expose the internal surface', async () => {
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/api/internal',
    );

    expect(response.status).toBe(404);
  });

  it('lists topics in the order the repository returns them, as ISO timestamps', async () => {
    const repositories = createFakeRepositories({
      topics: { list: async () => [topicA, topicB] },
    });

    const response = await request(createApp({ repositories })).get('/api/topics');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        slug: 'topic-a',
        title: 'Topic A',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
      {
        slug: 'topic-b',
        title: 'Topic B',
        createdAt: '2024-02-01T00:00:00.000Z',
        updatedAt: '2024-02-02T00:00:00.000Z',
      },
    ]);
  });

  it('does not leak the internal row id in a topic listing', async () => {
    const repositories = createFakeRepositories({ topics: { list: async () => [topicA] } });

    const response = await request(createApp({ repositories })).get('/api/topics');

    expect(response.body[0]).not.toHaveProperty('id');
  });

  it('returns a 500 when the repository fails', async () => {
    const repositories = createFakeRepositories({
      topics: { list: () => Promise.reject(new Error('database unavailable')) },
    });

    const response = await request(createApp({ repositories })).get('/api/topics');

    expect(response.status).toBe(500);
  });

  it('finds a topic by slug, as ISO timestamps', async () => {
    const repositories = createFakeRepositories({ topics: { findBySlug: async () => topicA } });

    const response = await request(createApp({ repositories })).get('/api/topics/topic-a');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      slug: 'topic-a',
      title: 'Topic A',
      description: 'All about topic A.',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });
  });

  it('does not leak the internal row id in a topic detail', async () => {
    const repositories = createFakeRepositories({ topics: { findBySlug: async () => topicA } });

    const response = await request(createApp({ repositories })).get('/api/topics/topic-a');

    expect(response.body).not.toHaveProperty('id');
  });

  it('returns the standard not-found body for an unknown slug', async () => {
    const repositories = createFakeRepositories({ topics: { findBySlug: async () => undefined } });

    const response = await request(createApp({ repositories })).get('/api/topics/no-such-topic');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('finds an indicator by its fingertips id', async () => {
    const repositories = createFakeRepositories({
      indicators: { findApprovedByFingertipsId: async () => indicatorDetail },
    });

    const response = await request(createApp({ repositories })).get('/api/indicators/108');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(indicatorDetail);
  });

  it('returns the standard not-found body for an unknown fingertips id', async () => {
    const repositories = createFakeRepositories({
      indicators: { findApprovedByFingertipsId: async () => undefined },
    });

    const response = await request(createApp({ repositories })).get('/api/indicators/424242');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('lists current areas of a type', async () => {
    const listByType = vi
      .fn()
      .mockResolvedValue([{ code: 'E12000001', name: 'North East region (statistical)' }]);
    const repositories = createFakeRepositories({ areas: { listByType } });

    const response = await request(createApp({ repositories })).get(
      `/api/areas?area_type=${encodeURIComponent('Regions (statistical)')}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        areaType: 'Regions (statistical)',
        areas: [{ code: 'E12000001', name: 'North East region (statistical)' }],
      },
    ]);
    expect(listByType).toHaveBeenCalledWith('Regions (statistical)');
  });

  it('rejects an areas request without an area type', async () => {
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/api/areas',
    );

    expect(response.status).toBe(400);
  });

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
    const repositories = createFakeRepositories({ indicators: { findObservations } });

    const response = await request(createApp({ repositories })).get('/api/indicators/108/data');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(data);
    expect(findObservations).toHaveBeenCalledWith(108, 'E92000001');
  });

  it('passes an explicit area code through to the repository', async () => {
    const findObservations = vi
      .fn()
      .mockResolvedValue({ areaCode: 'E06000001', areaName: 'Hartlepool', observations: [] });
    const repositories = createFakeRepositories({ indicators: { findObservations } });

    const response = await request(createApp({ repositories })).get(
      '/api/indicators/108/data?area_code=E06000001',
    );

    expect(response.status).toBe(200);
    expect(findObservations).toHaveBeenCalledWith(108, 'E06000001');
  });

  it('rejects a malformed area code without touching the repository', async () => {
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/api/indicators/108/data?area_code=../nope',
    );

    expect(response.status).toBe(404);
  });

  it('returns not-found for observations of an unknown indicator', async () => {
    const repositories = createFakeRepositories({
      indicators: { findObservations: async () => undefined },
    });

    const response = await request(createApp({ repositories })).get('/api/indicators/424242/data');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('rejects a non-numeric indicator id without touching the repository', async () => {
    // No stub: if the route reached the repository, the fake would throw and this would 500.
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/api/indicators/not-a-number',
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('fails loudly when a route reaches for a repository the test did not stub', async () => {
    const response = await request(createApp({ repositories: createFakeRepositories() })).get(
      '/api/topics',
    );

    expect(response.status).toBe(500);
  });
});
