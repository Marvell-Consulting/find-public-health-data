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
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { indicatorAreaDataSchema, indicatorDetailSchema } from './contract.js';
import { publicApiRoutes } from './index.js';

const MORTALITY_UNDER_75 = 'under-75-mortality-rate-from-all-causes';
const DIABETES_QOF_PREVALENCE = 'diabetes-qof-prevalence';

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

/** An indicator with both its aliases, as the migration and the seed give every indicator. */
async function insertIndicator(
  status: string,
  number: number,
  slug: string,
  published: boolean,
): Promise<void> {
  const inserted = await owner`
    INSERT INTO indicator
      (name, value_type_id, unit_id, year_type_id, polarity_id, frequency_id,
       status, created_by, updated_by)
    SELECT ${slug}, vt.id, u.id, yt.id, p.id, f.id,
           ${status}, 'integration-test', 'integration-test'
    FROM value_type vt, unit u, year_type yt, polarity p, frequency f
    LIMIT 1
    RETURNING id
  `;
  const indicatorId = inserted[0]?.id;
  await owner`
    INSERT INTO indicator_alias (indicator_id, slug, is_published, is_canonical)
    VALUES (${indicatorId}, ${String(number)}, ${published}, false),
           (${indicatorId}, ${slug}, ${published}, ${published})
  `;
}

describe('public routers against the seeded database', () => {
  it('lists the seeded indicators', async () => {
    const response = await request(app).get('/api/indicators');

    expect(response.status).toBe(200);
    expect(response.body.indicators).toHaveLength(13);
    expect(response.body.indicators[0]).toEqual({
      slug: expect.any(String),
      number: expect.any(Number),
      name: expect.any(String),
      status: 'approved',
    });
    const names = response.body.indicators.map((i: { name: string }) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('does not list indicators that are not approved', async () => {
    await insertIndicator('draft', 999999, 'integration-test-draft-indicator', true);

    const response = await request(app).get('/api/indicators');

    expect(response.status).toBe(200);
    expect(response.body.indicators).toHaveLength(13);
  });

  it('does not serve a draft indicator under an unpublished alias', async () => {
    await insertIndicator('draft', 999997, 'integration-test-pending-indicator', false);

    expect((await request(app).get('/api/indicators/999997')).status).toBe(404);
    expect(
      (await request(app).get('/api/indicators/integration-test-pending-indicator')).status,
    ).toBe(404);
  });

  // A Fingertips-era link still arrives, at the address the page is published under.
  it('redirects an indicator number to the canonical slug', async () => {
    const response = await request(app).get('/api/indicators/108?ignored=1');

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe(`/api/indicators/${MORTALITY_UNDER_75}?ignored=1`);
  });

  it('returns the full detail for a seeded indicator, matching the wire contract', async () => {
    const response = await request(app).get(`/api/indicators/${MORTALITY_UNDER_75}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      slug: MORTALITY_UNDER_75,
      number: 108,
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
    const response = await request(app).get(`/api/indicators/${MORTALITY_UNDER_75}/data`);

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
    const detail = await request(app).get(`/api/indicators/${DIABETES_QOF_PREVALENCE}`);

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      slug: DIABETES_QOF_PREVALENCE,
      number: 241,
      name: 'Diabetes: QOF prevalence',
      valueType: 'Proportion',
      unit: { label: '%' },
    });
    expect(detail.body.areaTypes.map(({ name }: { name: string }) => name)).toEqual(
      expect.arrayContaining(['England', 'GPs', 'ICBs', 'NHS regions', 'Regions (statistical)']),
    );

    const cornwall = await request(app).get(
      `/api/indicators/${DIABETES_QOF_PREVALENCE}/data?areaCode=E06000052`,
    );
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
      SELECT ia.slug, a.code FROM indicator i
      JOIN indicator_alias ia ON ia.indicator_id = i.id AND ia.is_canonical
      CROSS JOIN area a
      WHERE i.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM observation o
        WHERE o.indicator_id = i.id AND o.area_id = a.id AND o.deleted_at IS NULL
      )
      LIMIT 1
    `;
    const pair = rows[0];
    expect(pair).toBeTruthy();

    const response = await request(app).get(
      `/api/indicators/${pair?.slug}/data?areaCode=${pair?.code}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.observations).toEqual([]);
  });

  it('returns 404 for an alias no indicator answers to', async () => {
    const response = await request(app).get('/api/indicators/424242');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('does not serve an indicator that is not approved', async () => {
    const slug = 'integration-test-archived-indicator';
    await insertIndicator('archived', 999998, slug, true);

    expect((await request(app).get(`/api/indicators/${slug}`)).status).toBe(404);
    expect((await request(app).get(`/api/indicators/${slug}/data`)).status).toBe(404);
    expect(
      (await request(app).get(`/api/indicators/${slug}/range?displayGroup=Local%20authorities`))
        .status,
    ).toBe(404);
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
