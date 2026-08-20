import { once } from 'node:events';
import { createReadStream, readFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

import type postgres from 'postgres';

import { createDbFromTransaction } from './client.js';
import {
  applyIndicatorTopics,
  type IndicatorTopicFile,
  type IndicatorTopicImportSummary,
  parseIndicatorTopicFile,
} from './indicator-topic-repository.js';

// Topological FK order: every table loads after the tables it references.
// Self-references (dimension_value.parent_id etc.) resolve within a single COPY
// because FK checks run at end of statement.
const SEED_TABLES = [
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

const READ_MODEL_TABLES = ['latest_headline', 'available_data', 'indicator_dimension_values'];

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
): Promise<number> {
  const file = `${seedDir}${table}.csv.gz`;
  const columns = await readCsvHeader(file);
  const columnList = columns.map((c) => `"${c}"`).join(', ');
  const writable = await sql
    .unsafe(`COPY "${table}" (${columnList}) FROM STDIN WITH (FORMAT csv, HEADER true)`)
    .writable();

  // postgres.js drops a COPY error that arrives after the input stream has already
  // ended (the stream is nulled before the server responds), leaving 'finish'
  // unemitted and pipeline() hanging forever. Stream the data without awaiting
  // completion, wait for finish/error with a timeout, then verify the row count.
  const streamed = pipeline(createReadStream(file), createGunzip(), writable, { end: true });
  const outcome = await Promise.race([
    streamed.then(() => 'finished' as const),
    once(writable, 'error').then(([err]) => Promise.reject(err)),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 120_000).unref()),
  ]);
  if (outcome === 'timeout') {
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
export function assertSeedingAllowed(appEnv: string | undefined): void {
  assertDevClassEnv('seed', appEnv);
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
): Promise<IndicatorTopicImportSummary> {
  await seedTables(tx);
  return applyIndicatorTopics(createDbFromTransaction(tx), readDummyRelationships());
}

async function seedTables(tx: postgres.TransactionSql): Promise<void> {
  const allTables = [...SEED_TABLES, ...READ_MODEL_TABLES].map((t) => `"${t}"`).join(', ');
  await tx.unsafe(`TRUNCATE ${allTables} CASCADE`);

  for (const table of SEED_TABLES) {
    const count = await loadTable(tx, table);
    console.log(`${table}: ${count} rows`);
  }
}
