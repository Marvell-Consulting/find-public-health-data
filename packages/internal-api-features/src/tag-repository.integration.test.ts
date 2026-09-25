import { appEnvFields, parseEnv, z } from '@fphd/config';
import { createDb, type Database, dbEnvFields, resolveDbTls, schema } from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listTagOptions } from './tag-repository.ts';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

let testDb: TestDatabase;
let db: Database;

/** Each inserted row's id by the name the page shows. */
const ids = new Map<string, string>();

function idOf(name: string): string {
  const id = ids.get(name);
  if (id === undefined) throw new Error(`inserted nothing named ${name}`);
  return id;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: testDb.name,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  });

  const topics = await db
    .insert(schema.topic)
    .values([
      { slug: 'smoking', title: 'Smoking', description: 'About smoking.' },
      { slug: 'alcohol', title: 'Alcohol', description: 'About alcohol.' },
    ])
    .returning({ id: schema.topic.id, name: schema.topic.title });
  const classifications = await db
    .insert(schema.classification)
    .values([
      { dimension: 'indicator_type', slug: 'indicator-type-outcome', name: 'Outcome' },
      {
        dimension: 'indicator_type',
        slug: 'indicator-type-healthcare-utilisation',
        name: 'Healthcare utilisation',
      },
      { dimension: 'risk_factor', slug: 'risk-factor-violence', name: 'Violence' },
      { dimension: 'risk_factor', slug: 'risk-factor-alcohol', name: 'Alcohol use' },
      {
        dimension: 'framework',
        slug: 'framework-public-health-outcomes-framework',
        name: 'Public Health Outcomes Framework',
      },
      { dimension: 'population', slug: 'population-all-ages', name: 'All ages' },
      { dimension: 'inequality', slug: 'inequality-sex', name: 'Sex' },
    ])
    .returning({ id: schema.classification.id, name: schema.classification.name });

  for (const { id, name } of [...topics, ...classifications]) ids.set(name, id);
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

describe('listTagOptions', () => {
  it('lists the topics and each tagged dimension by name, leaving the other dimensions out', async () => {
    const option = (name: string) => ({ id: idOf(name), name });

    await expect(listTagOptions(db)).resolves.toEqual({
      topics: [option('Alcohol'), option('Smoking')],
      indicatorTypes: [option('Healthcare utilisation'), option('Outcome')],
      riskFactors: [option('Alcohol use'), option('Violence')],
      frameworks: [option('Public Health Outcomes Framework')],
    });
  });
});
