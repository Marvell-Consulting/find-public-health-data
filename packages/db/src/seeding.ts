import { once } from 'node:events';
import { createReadStream, readFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

import type postgres from 'postgres';

import { createDbFromTransaction } from './client.ts';
import {
  applyIndicatorTopics,
  type IndicatorTopicFile,
  type IndicatorTopicImportSummary,
  parseIndicatorTopicFile,
} from './indicator-topic-repository.ts';
import { READ_MODEL_TABLES } from './read-models.ts';

// Topological FK order: every table loads after the tables it references.
// Self-references (dimension_value.parent_id etc.) resolve within a single COPY
// because FK checks run at end of statement.
export const SEED_TABLES = [
  'value_type',
  'unit',
  'year_type',
  'ci_method',
  'polarity',
  'frequency',
  'comparator_method',
  'data_source',
  'numerator_denominator_source',
  'dimension_type',
  'dimension_value',
  'area_type',
  'area',
  'area_relationship',
  'indicator',
  'indicator_metadata',
  'upload_batch',
  'note_type',
  'observation',
  'observation_dimension',
  'observation_note',
] as const;

const seedDir = fileURLToPath(new URL('../data/seed/', import.meta.url));

async function readCsvHeader(file: string): Promise<string[]> {
  const stream = createReadStream(file).pipe(createGunzip());
  let text = '';
  for await (const chunk of stream) {
    text += chunk.toString('utf8');
    const newline = text.indexOf('\n');
    if (newline !== -1) {
      stream.destroy();
      return text.slice(0, newline).trim().split(',');
    }
  }
  throw new Error(`No header row in ${file}`);
}

async function loadTable(
  sql: postgres.Sql | postgres.TransactionSql,
  table: string,
  directory: string,
): Promise<number> {
  const file = `${directory}/${table}.csv.gz`;
  const columns = await readCsvHeader(file);
  const columnList = columns.map((c) => `"${c}"`).join(', ');
  const writable = await sql
    .unsafe(`COPY "${table}" (${columnList}) FROM STDIN WITH (FORMAT csv, HEADER true)`)
    .writable();

  // postgres.js drops a COPY error that arrives after the input stream has already
  // ended (the stream is nulled before the server responds), leaving 'finish'
  // unemitted and pipeline() hanging forever. Stream the data without awaiting
  // completion, wait for finish/error with a timeout, then verify the row count.
  const decompressed = createGunzip();
  const abort = new AbortController();
  const streamed = pipeline(createReadStream(file), decompressed, writable, {
    end: true,
    signal: abort.signal,
  });
  let timeout: NodeJS.Timeout | undefined;
  const afterSourceEnds = once(decompressed, 'end').then(
    () =>
      new Promise<'timeout'>((resolve) => {
        timeout = setTimeout(() => resolve('timeout'), 300_000).unref();
      }),
  );
  const outcome = await Promise.race([
    streamed.then(() => 'finished' as const),
    once(writable, 'error').then(([err]) => Promise.reject(err)),
    afterSourceEnds,
  ]).finally(() => clearTimeout(timeout));
  if (outcome === 'timeout') {
    abort.abort();
    await streamed.catch(() => undefined);
    throw new Error(`COPY into "${table}" did not complete — likely rejected by Postgres`);
  }
  const rows = await sql.unsafe(`SELECT count(*)::int AS count FROM "${table}"`);
  const count = Number(rows[0]?.count ?? 0);
  if (count === 0) {
    throw new Error(`COPY into "${table}" loaded no rows — check the seed CSV`);
  }
  return count;
}

// Its own list rather than isDeployedEnv: 'dev' is deployed but is populated by running the
// seed against it, while 'preview' and 'production' hold data no command may erase. The
// integration harness runs under 'test' and seeds through seedDummyTables directly, but the
// value is listed so that path stays permitted if it ever reaches for the CLI.
const DEV_CLASS_APP_ENVS = ['local', 'test', 'dev'];

/** Fails closed: an explicit APP_ENV is required rather than a missing value being assumed safe. */
function assertDevClassEnv(action: string, appEnv: string | undefined): void {
  if (appEnv !== undefined && DEV_CLASS_APP_ENVS.includes(appEnv)) return;

  throw new Error(
    `Refusing to ${action}: APP_ENV is ${appEnv === undefined ? 'unset' : `'${appEnv}'`}; ` +
      `set it to one of ${DEV_CLASS_APP_ENVS.map((value) => `'${value}'`).join(', ')} explicitly`,
  );
}

/** The seed erases and replaces every dummy table. */
export function assertSeedingAllowed(appEnv: string | undefined, action = 'seed dummy data'): void {
  assertDevClassEnv(action, appEnv);
}

/** A reset erases the whole application schema. Same gate as seeding, deliberately. */
export function assertResetAllowed(appEnv: string | undefined): void {
  assertDevClassEnv('reset', appEnv);
}

// The three files are separate concerns but a single import: they all key off the same
// indicators, so importing one without the others would leave the site half-populated.
const dummyRelationshipFiles = [
  '../data/indicator-topics.json',
  '../data/indicator-classifications.json',
  '../data/indicator-data-updated.json',
].map((path) => fileURLToPath(new URL(path, import.meta.url)));

function readDummyRelationships(): IndicatorTopicFile {
  const merged: Record<string, unknown> = {};
  for (const file of dummyRelationshipFiles) {
    Object.assign(merged, JSON.parse(readFileSync(file, 'utf-8')));
  }
  return parseIndicatorTopicFile(merged);
}

export interface DummySeedSummary {
  /** Rows loaded per seed table, in load order. */
  tables: Record<string, number>;
  relationships: IndicatorTopicImportSummary;
}

/**
 * Erase and reload every dummy table from the committed seed, inside the caller's
 * transaction: the CSV-backed canonical tables first, then the JSON-backed indicator
 * relationships, which reference the freshly loaded indicators and the topics the core
 * import owns. The core-data tables (topics) are never wiped — the TRUNCATE cascades only
 * into tables that reference the dummy ones, such as the indicator-topic links themselves.
 * Callers own the safety decision — the seed-dummy-data command calls
 * assertSeedingAllowed, and the integration harness only ever targets its own disposable
 * databases.
 */
export async function seedDummyTables(
  tx: postgres.TransactionSql,
  directory = seedDir,
): Promise<DummySeedSummary> {
  // Read before any database work, so a bad file fails while the transaction has done nothing.
  const relationshipFile = readDummyRelationships();
  const tables = await seedTables(tx, directory);
  const relationships = await applyIndicatorTopics(createDbFromTransaction(tx), relationshipFile);
  return { tables, relationships };
}

/** Load only snapshot CSVs; published data has no dummy JSON relationships. */
export async function seedPublishedTables(
  tx: postgres.TransactionSql,
  directory: string,
): Promise<Record<string, number>> {
  return seedTables(tx, directory);
}

async function seedTables(
  tx: postgres.TransactionSql,
  directory: string,
): Promise<Record<string, number>> {
  const allTables = [...SEED_TABLES, ...READ_MODEL_TABLES].map((t) => `"${t}"`).join(', ');
  await tx.unsafe(`TRUNCATE ${allTables} CASCADE`);

  const counts: Record<string, number> = {};
  for (const table of SEED_TABLES) {
    counts[table] = await loadTable(tx, table, directory);
  }
  return counts;
}
