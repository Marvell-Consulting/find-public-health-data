import { appEnvFields, parseEnv, z } from '@fphd/config';
import {
  createDb,
  createRepositories,
  type Database,
  dbEnvFields,
  resolveDbTls,
  schema,
} from '@fphd/db';
import { createOwnerClient } from '@fphd/db/operations';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { PERIOD_TYPES, YEAR_TYPES } from '@fphd/utils/period-type';
import { SLUG_PATTERN } from '@fphd/utils/slug';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { indicatorAreaDataSchema, indicatorDetailSchema } from './contract.ts';
import { publicApiRoutes } from './index.ts';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    PUBLIC_API_PASSWORD: z.string().default('public_api'),
  }),
  process.env,
);

let testDb: TestDatabase;
let db: Database;
let owner: ReturnType<typeof createOwnerClient>;
let app: express.Express;

beforeAll(async () => {
  testDb = await createTestDatabase({ template: 'seeded' });
  // The public_api role, as the deployed app connects: the grant tests below depend on it.
  db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: testDb.name,
    user: 'public_api',
    password: env.PUBLIC_API_PASSWORD,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  });
  owner = createOwnerClient(testDb.name);
  app = express().use(publicApiRoutes(createRepositories(db)));
});

afterAll(async () => {
  await db.$client.end();
  await owner.end();
  await testDb.drop();
});

/** An identity whose only version is a draft: complete, but nothing the public may see. */
async function insertDraftOnlyIndicator(
  shortId: number,
  name: string,
  slug: string,
): Promise<number> {
  const [inserted] = await owner`
    WITH new_indicator AS (
      INSERT INTO indicator (short_id) VALUES (${shortId}) RETURNING id, short_id
    )
    INSERT INTO indicator_version
      (indicator_id, status, name, slug, value_type_id, unit_id, period_type_id, year_type_id,
       polarity, update_frequency, created_by, updated_by)
    SELECT i.id, 'draft', ${name}, ${slug}, vt.id, u.id, ${PERIOD_TYPES.years.id},
           ${YEAR_TYPES.calendar.id}, 'lower-is-better', 'annually',
           'integration-test', 'integration-test'
    FROM new_indicator i, value_type vt, unit u
    LIMIT 1
    RETURNING (SELECT short_id FROM new_indicator) AS short_id
  `;

  return Number(inserted?.short_id);
}

/** The slug the seed derived for indicator 108, which is also its public address. */
const MORTALITY_SLUG = 'under-75-mortality-rate-from-all-causes';

describe('public routers against the seeded database', () => {
  it('lists the seeded indicators', async () => {
    const response = await request(app).get('/api/indicators');

    expect(response.status).toBe(200);
    expect(response.body.indicators).toHaveLength(12);
    expect(response.body.indicators[0]).toEqual({
      shortId: expect.any(Number),
      slug: expect.stringMatching(SLUG_PATTERN),
      name: expect.any(String),
    });
    const names = response.body.indicators.map((i: { name: string }) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('does not list an indicator whose only version is a draft', async () => {
    const inserted = await insertDraftOnlyIndicator(
      999999,
      'integration-test draft indicator',
      'integration-test-draft-indicator',
    );
    const response = await request(app).get('/api/indicators');
    expect(response.status).toBe(200);
    expect(response.body.indicators).toHaveLength(12);
    const shortIds = response.body.indicators.map((i: { shortId: number }) => i.shortId);
    expect(shortIds).not.toContain(inserted);
  });

  it('returns the full detail for a seeded indicator, matching the wire contract', async () => {
    const response = await request(app).get('/api/indicators/108');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      shortId: 108,
      slug: MORTALITY_SLUG,
      name: expect.stringContaining('Under 75 mortality rate'),
      valueType: expect.any(String),
      unit: { name: expect.any(String), label: expect.any(String) },
      definition: expect.any(String),
    });
    expect(response.body.areaTypes.length).toBeGreaterThan(0);
    expect(response.body.areaTypes[0]).toEqual({
      name: expect.any(String),
      areaCount: expect.any(Number),
    });
    expect(response.body).not.toHaveProperty('id');
    expect(() => indicatorDetailSchema.parse(response.body)).not.toThrow();
  });

  it('serves the England observations for a seeded indicator, matching the wire contract', async () => {
    const response = await request(app).get('/api/indicators/108/data');

    expect(response.status).toBe(200);
    expect(response.body.areaCode).toBe('E92000001');
    expect(response.body.areaName).toBe('England');
    expect(response.body.observations.length).toBeGreaterThan(1000);
    expect(() => indicatorAreaDataSchema.parse(response.body)).not.toThrow();

    // The least-disaggregated England series for 108 carries a single Age dimension.
    const singleDimension = response.body.observations.filter(
      (o: { dimensions: unknown[] }) => o.dimensions.length === 1,
    );
    expect(singleDimension).toHaveLength(18);
    expect(singleDimension[0].dimensions[0]).toMatchObject({ type: 'Age', value: '<75 yrs' });
  });

  it('serves the prototype diabetes indicator across GP, NHS and local geographies', async () => {
    const detail = await request(app).get('/api/indicators/241');

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      shortId: 241,
      name: 'Diabetes: QOF prevalence',
      valueType: 'Proportion',
      unit: { label: '%' },
    });
    expect(detail.body.areaTypes.map(({ name }: { name: string }) => name)).toEqual(
      expect.arrayContaining(['England', 'GPs', 'ICBs', 'NHS regions', 'Regions (statistical)']),
    );

    const cornwall = await request(app).get('/api/indicators/241/data?areaCode=E06000052');
    expect(cornwall.status).toBe(200);
    expect(cornwall.body.areaName).toBe('Cornwall');
    expect(cornwall.body.observations).toHaveLength(13);
  });

  it('lists the current areas of a seeded area type', async () => {
    const response = await request(app).get(
      `/api/areas?areaType=${encodeURIComponent('Regions (statistical)')}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    const [group] = response.body;
    expect(group.areaType).toBe('Regions (statistical)');
    expect(group.areas).toHaveLength(9);
    expect(group.areas[0]).toEqual({ code: expect.any(String), name: expect.any(String) });
    const names = group.areas.map((a: { name: string }) => a.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('lists the current GP practices added for the prototype indicator', async () => {
    const response = await request(app).get('/api/areas?areaType=GPs');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].areaType).toBe('GPs');
    expect(response.body[0].areas).toHaveLength(6168);
  });

  it('returns an empty group for an unknown area type', async () => {
    const response = await request(app).get('/api/areas?areaType=No%20Such%20Type');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ areaType: 'No Such Type', areas: [] }]);
  });

  it('answers with one group per area type requested', async () => {
    const response = await request(app).get(
      `/api/areas?areaType=${encodeURIComponent('Regions (statistical)')}&areaType=England`,
    );

    expect(response.status).toBe(200);
    expect(response.body.map((g: { areaType: string }) => g.areaType)).toEqual([
      'Regions (statistical)',
      'England',
    ]);
    expect(response.body[1].areas).toHaveLength(1);
  });

  it('returns an empty observation list for an area with no data', async () => {
    const rows = await owner`
      SELECT i.short_id, a.code FROM indicator i CROSS JOIN area a
      WHERE EXISTS (
        SELECT 1 FROM indicator_version v
        WHERE v.indicator_id = i.id AND v.status = 'published'
      )
      AND NOT EXISTS (
        SELECT 1 FROM observation o
        WHERE o.indicator_id = i.id AND o.area_id = a.id AND o.deleted_at IS NULL
      )
      LIMIT 1
    `;
    const pair = rows[0];
    expect(pair).toBeTruthy();

    const response = await request(app).get(
      `/api/indicators/${pair?.short_id}/data?areaCode=${pair?.code}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.observations).toEqual([]);
  });

  it('returns 404 for a short id with no indicator', async () => {
    const response = await request(app).get('/api/indicators/424242');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('does not serve an indicator that is not published, by number or by slug', async () => {
    await insertDraftOnlyIndicator(
      999998,
      'integration-test unpublished indicator',
      'integration-test-unpublished-indicator',
    );

    expect((await request(app).get('/api/indicators/999998')).status).toBe(404);
    expect((await request(app).get('/api/indicators/999998/data')).status).toBe(404);
    expect(
      (await request(app).get('/api/indicators/999998/range?displayGroup=Local%20authorities'))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get('/api/indicators/integration-test-unpublished-indicator')).status,
    ).toBe(404);
  });

  it('serves an indicator addressed by slug, in any case, with 200 rather than a redirect', async () => {
    const bySlug = await request(app).get(`/api/indicators/${MORTALITY_SLUG}`);
    const byUpperCase = await request(app).get(`/api/indicators/${MORTALITY_SLUG.toUpperCase()}`);

    expect(bySlug.status).toBe(200);
    expect(byUpperCase.status).toBe(200);
    expect(bySlug.body.shortId).toBe(108);
    expect(byUpperCase.body.slug).toBe(MORTALITY_SLUG);
  });

  it('serves the data and range routes by slug too', async () => {
    const data = await request(app).get(`/api/indicators/${MORTALITY_SLUG}/data`);
    const range = await request(app).get(
      `/api/indicators/${MORTALITY_SLUG}/range?displayGroup=Local%20authorities`,
    );

    expect(data.status).toBe(200);
    expect(data.body.areaCode).toBe('E92000001');
    expect(range.status).toBe(200);
  });

  it('matches a slug-shaped query exactly, as it does a short id', async () => {
    const response = await request(app).get(
      `/api/indicators/search?q=${MORTALITY_SLUG.toUpperCase()}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.indicators[0]).toMatchObject({ shortId: 108, slug: MORTALITY_SLUG });
  });

  it('connects with a read-only role', async () => {
    await expect(
      db.insert(schema.valueType).values({ name: 'integration-test-denied' }),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('cannot read operational upload data', async () => {
    await expect(
      db.select({ id: schema.uploadBatch.id }).from(schema.uploadBatch),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('returns facets matching the wire contract shape', async () => {
    const { indicatorFacetsSchema } = await import('@fphd/public-api-features/contract');

    const response = await request(app).get('/api/indicators/facets');

    expect(response.status).toBe(200);
    expect(() => indicatorFacetsSchema.parse(response.body)).not.toThrow();
    expect(response.body.topics.length).toBeGreaterThan(0);
    expect(response.body.topics[0]).toMatchObject({
      slug: expect.any(String),
      title: expect.any(String),
    });
  });

  it('returns search results matching the wire contract shape', async () => {
    const { indicatorSearchResultSchema } = await import('@fphd/public-api-features/contract');

    const response = await request(app).get('/api/indicators/search?q=mortality');

    expect(response.status).toBe(200);
    expect(() => indicatorSearchResultSchema.parse(response.body)).not.toThrow();
    expect(response.body).toMatchObject({
      total: expect.any(Number),
      indicators: expect.any(Array),
    });
  });
});
