import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type postgres from 'postgres';

import {
  type CiMethodUpsertResult,
  parseCiMethodsFile,
  upsertCiMethods,
} from './ci-method-core-data.ts';
import { createDbFromClient } from './client.ts';
import {
  type DataProviderUpsertResult,
  parseDataProvidersFile,
  upsertDataProviders,
} from './data-provider-core-data.ts';
import { parseTopicsFile } from './parse-topics-file.ts';
import { type UpsertResult, upsertTopics } from './topic-repository.ts';

// Resolves identically from src/ and from dist/, both of which sit one level under the
// package root alongside data/.
const topicsFile = fileURLToPath(new URL('../data/topics.json', import.meta.url));
const ciMethodsFile = fileURLToPath(new URL('../data/ci-methods.json', import.meta.url));
const dataProvidersFile = fileURLToPath(new URL('../data/data-providers.json', import.meta.url));

export interface CoreDataImport {
  topics: UpsertResult;
  ciMethods: CiMethodUpsertResult;
  dataProviders: DataProviderUpsertResult;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf-8'));
}

/**
 * Load the required core content — topics, and the confidence interval methods and data
 * providers a publisher chooses from — from the committed data files. This is permanent content every environment
 * needs, so unlike the dummy seed it carries no environment gate, and it is idempotent: the
 * upserts key on stable ids, re-runs are no-ops, and rows absent from a file are reported
 * rather than deleted. Future core reference or content data joins this function rather
 * than growing new commands.
 */
export async function importCoreData(sql: postgres.Sql): Promise<CoreDataImport> {
  // Every file is read first, so a bad one fails before anything is written.
  const topicRecords = parseTopicsFile(readJson(topicsFile));
  const ciMethodRecords = parseCiMethodsFile(readJson(ciMethodsFile));
  const dataProviderRecords = parseDataProvidersFile(readJson(dataProvidersFile));
  const db = createDbFromClient(sql);

  return {
    topics: await upsertTopics(db, topicRecords),
    ciMethods: await upsertCiMethods(db, ciMethodRecords),
    dataProviders: await upsertDataProviders(db, dataProviderRecords),
  };
}

/**
 * Guard for data that depends on core content: the dummy indicator-topic links reference
 * topics by id, so seeding an environment that has never imported them would silently
 * drop every link, and the seed and snapshot map Fingertips' sources onto the data providers.
 */
export async function assertCoreDataPresent(sql: postgres.Sql): Promise<void> {
  let counts: { topics: number; dataProviders: number } | undefined;
  try {
    [counts] = await sql<{ topics: number; dataProviders: number }[]>`
      SELECT (SELECT count(*) FROM topic)::int AS topics,
        (SELECT count(*) FROM data_provider)::int AS "dataProviders"
    `;
  } catch (error) {
    // undefined_table: point at the missing migration rather than surface the raw error.
    if ((error as { code?: string }).code === '42P01') {
      throw new Error('The core data tables are missing — run `db migrate` before seeding');
    }
    throw error;
  }
  if (!counts?.topics) {
    throw new Error('No topics in the database — run `db import-core-data` before seeding');
  }
  if (!counts.dataProviders) {
    throw new Error('No data providers in the database — run `db import-core-data` before seeding');
  }
}
