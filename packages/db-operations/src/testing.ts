import { createOwnerClient, TEMPLATES, TEST_DATABASE_PREFIX } from '@fphd/db/testing';

import { importCoreData } from './core-data.ts';
import { migrateToLatest } from './migrations.ts';
import { rebuildReadModels } from './read-models.ts';
import { seedDummyTables } from './seeding.ts';

async function dropTestDatabases(): Promise<void> {
  const admin = createOwnerClient('postgres');
  try {
    const leftovers = await admin`
      SELECT datname FROM pg_database WHERE datname LIKE ${`${TEST_DATABASE_PREFIX}%`}
    `;
    for (const { datname } of leftovers) {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
}

async function buildTemplate(name: string, seed: boolean): Promise<void> {
  const admin = createOwnerClient('postgres');
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const template = createOwnerClient(name);
  try {
    await migrateToLatest(template);
    if (seed) {
      // The same sequence a deployed environment runs: core content first, since the dummy
      // relationships reference topics by id, then the dummy seed, then the read models.
      await importCoreData(template);
      await template.begin((tx) => seedDummyTables(tx));
      await rebuildReadModels(template);
    }
  } finally {
    // Left with no connections: a template with an open session cannot be copied.
    await template.end();
  }
}

/**
 * Build the templates the integration tier copies from, dropped and recreated each run.
 * Runs once from the root Vitest global setup, where there is no hook timeout and nothing
 * else is competing for the templates.
 */
export async function setUpTestTemplate(): Promise<void> {
  await dropTestDatabases();
  await buildTemplate(TEMPLATES.schema, false);
  await buildTemplate(TEMPLATES.seeded, true);
}

export async function tearDownTestTemplate(): Promise<void> {
  await dropTestDatabases();
}
