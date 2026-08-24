import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type postgres from 'postgres';

import { createDbFromClient } from './client.js';
import { parseTopicsFile } from './parse-topics-file.js';
import { type UpsertResult, upsertTopics } from './topic-repository.js';

// Resolves identically from src/ and from dist/, both of which sit one level under the
// package root alongside data/.
const topicsFile = fileURLToPath(new URL('../data/topics.json', import.meta.url));

/**
 * Load the required core content — topics, today — from the committed data files. This is
 * permanent content every environment needs, so unlike the dummy seed it carries no
 * environment gate, and it is idempotent: the upsert keys on stable ids, re-runs are
 * no-ops, and rows absent from the file are reported rather than deleted. Future core
 * reference or content data joins this function rather than growing new commands.
 */
export async function importCoreData(sql: postgres.Sql): Promise<UpsertResult> {
  const records = parseTopicsFile(JSON.parse(readFileSync(topicsFile, 'utf-8')));
  return upsertTopics(createDbFromClient(sql), records);
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
