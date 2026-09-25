import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type postgres from 'postgres';
import {
  type CiMethodUpsertResult,
  parseCiMethodsFile,
  upsertCiMethods,
} from './ci-method-core-data.ts';
import {
  type ClassificationUpsertResult,
  parseClassificationsFile,
  upsertClassifications,
} from './classification-core-data.ts';
import { createDbFromClient } from './client.ts';
import { parseTopicsFile } from './parse-topics-file.ts';
import { type UpsertResult, upsertTopics } from './topic-repository.ts';

// Resolves identically from src/ and from dist/, both of which sit one level under the
// package root alongside data/.
const topicsFile = fileURLToPath(new URL('../data/topics.json', import.meta.url));
const ciMethodsFile = fileURLToPath(new URL('../data/ci-methods.json', import.meta.url));
const classificationsFile = fileURLToPath(new URL('../data/classifications.json', import.meta.url));

export interface CoreDataImport {
  topics: UpsertResult;
  ciMethods: CiMethodUpsertResult;
  classifications: ClassificationUpsertResult;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf-8'));
}

/**
 * Load the required core content — topics, the confidence interval methods a publisher
 * chooses from, and the classifications an indicator is tagged with — from the committed
 * data files. This is permanent content every environment needs, so unlike the dummy seed it
 * carries no environment gate, and it is idempotent: the upserts key on stable ids (slugs for
 * classifications), re-runs are no-ops, and rows absent from a file are reported rather than
 * deleted. Future core reference or content data joins this function rather
 * than growing new commands.
 */
export async function importCoreData(sql: postgres.Sql): Promise<CoreDataImport> {
  // Every file is read first, so a bad one fails before anything is written.
  const topicRecords = parseTopicsFile(readJson(topicsFile));
  const ciMethodRecords = parseCiMethodsFile(readJson(ciMethodsFile));
  const classificationRecords = parseClassificationsFile(readJson(classificationsFile));
  const db = createDbFromClient(sql);

  return {
    topics: await upsertTopics(db, topicRecords),
    ciMethods: await upsertCiMethods(db, ciMethodRecords),
    classifications: await upsertClassifications(db, classificationRecords),
  };
}

/**
 * Guard for data that depends on core content: the dummy indicator-topic links reference
 * topics by id, so seeding an environment that has never imported them would silently
 * drop every link.
 */
export async function assertCoreDataPresent(sql: postgres.Sql): Promise<void> {
  let count: number;
  try {
    const [row] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM topic`;
    count = row?.count ?? 0;
  } catch (error) {
    // undefined_table: point at the missing migration rather than surface the raw error.
    if ((error as { code?: string }).code === '42P01') {
      throw new Error('No topic table in the database — run `db migrate` before seeding');
    }
    throw error;
  }
  if (count === 0) {
    throw new Error('No topics in the database — run `db import-core-data` before seeding');
  }
}
