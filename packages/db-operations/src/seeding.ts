import { createReadStream, readFileSync } from 'node:fs';
import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

import { createDbFromTransaction } from '@fphd/db';
import type postgres from 'postgres';

import {
  applyIndicatorTopics,
  type IndicatorTopicFile,
  type IndicatorTopicImportSummary,
  parseIndicatorTopicFile,
} from './indicator-topic-import.ts';
import { READ_MODEL_TABLES } from './read-models.ts';

// Topological FK order: every table loads after the tables it references.
// Self-references (dimension_value.parent_id etc.) resolve within a single COPY
// because FK checks run at end of statement. The files carry ci_method, but the table is
// core data: the source's methods are read only to point its versions at ours.
export const SEED_TABLES = [
  'value_type',
  'unit',
  'year_type',
  'ci_method',
  'comparator_method',
  'data_source',
  'numerator_denominator_source',
  'dimension_type',
  'dimension_value',
  'area_type',
  'area',
  'area_relationship',
  'indicator',
  'indicator_version',
  'upload_batch',
  'note_type',
  'observation',
  'observation_dimension',
  'observation_note',
] as const;

const seedDir = fileURLToPath(new URL('../data/seed/', import.meta.url));
const COPY_IDLE_TIMEOUT_MS = 300_000;
// Matches the deployed beta operations job's outer execution limit.
const PUBLISHED_COPY_TIMEOUT_MS = 6 * 60 * 60 * 1_000;

/** The COPY takes its column list from the file, so callers can check one before importing. */
export async function readCsvHeader(file: string): Promise<string[]> {
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

/** Loads a table's CSV into that table, or into `into`, such as a staging table. */
async function loadTable(
  sql: postgres.Sql | postgres.TransactionSql,
  table: string,
  directory: string,
  idleTimeoutMs = COPY_IDLE_TIMEOUT_MS,
  completionTimeoutMs = idleTimeoutMs,
  into = table,
): Promise<number> {
  const file = `${directory}/${table}.csv.gz`;
  const columns = await readCsvHeader(file);
  // A file exported before a migration renamed or dropped a column would otherwise fail on COPY.
  const known = await sql<{ name: string }[]>`
    SELECT attname AS name FROM pg_attribute
    WHERE attrelid = ${`"${into}"`}::regclass AND attnum > 0 AND NOT attisdropped
  `;
  const unknown = columns.filter((column) => !known.some(({ name }) => name === column));
  if (unknown.length > 0) {
    throw new Error(
      `${table}.csv.gz has columns ${table} does not: ${unknown.join(', ')}. Export it again against the current schema`,
    );
  }
  const columnList = columns.map((c) => `"${c}"`).join(', ');
  const writable = await sql
    .unsafe(`COPY "${into}" (${columnList}) FROM STDIN WITH (FORMAT csv, HEADER true)`)
    .writable();

  await streamSeedCsv(file, writable, table, idleTimeoutMs, completionTimeoutMs);
  const rows = await sql.unsafe(`SELECT count(*)::int AS count FROM "${into}"`);
  const count = Number(rows[0]?.count ?? 0);
  if (count === 0) {
    throw new Error(`COPY into "${table}" loaded no rows — check the seed CSV`);
  }
  return count;
}

/** Abort a COPY that stops making progress, including before its input reaches EOF. */
export async function streamSeedCsv(
  file: string,
  writable: Writable,
  table: string,
  idleTimeoutMs = COPY_IDLE_TIMEOUT_MS,
  completionTimeoutMs = idleTimeoutMs,
): Promise<void> {
  const decompressed = createGunzip();
  const abort = new AbortController();
  // postgres.js can leave finish unemitted if Postgres rejects COPY after the
  // stream ends. Refreshing on decompressed chunks also catches mid-stream stalls.
  let timeout: NodeJS.Timeout | undefined;
  const stopWaiting = () => clearTimeout(timeout);
  const stalled = new Promise<'stalled'>((resolve) => {
    const markStalled = () => resolve('stalled');
    timeout = setTimeout(markStalled, idleTimeoutMs).unref();
    decompressed.once('end', () => {
      stopWaiting();
      timeout = setTimeout(markStalled, completionTimeoutMs).unref();
    });
  });
  const onProgress = () => timeout?.refresh();
  decompressed.on('data', onProgress);
  const streamed = pipeline(createReadStream(file), decompressed, writable, {
    end: true,
    signal: abort.signal,
  });
  try {
    if ((await Promise.race([streamed.then(() => 'finished' as const), stalled])) === 'stalled') {
      abort.abort();
      await streamed.catch(() => undefined);
      throw new Error(`COPY into "${table}" stopped making progress`);
    }
  } finally {
    stopWaiting();
    decompressed.off('data', onProgress);
  }
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
const publishedTopicFile = fileURLToPath(
  new URL('../data/published-indicator-topics.json', import.meta.url),
);

function readDummyRelationships(): IndicatorTopicFile {
  const merged: Record<string, unknown> = {};
  for (const file of dummyRelationshipFiles) {
    Object.assign(merged, JSON.parse(readFileSync(file, 'utf-8')));
  }
  return parseIndicatorTopicFile(merged);
}

export interface SeedSummary {
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
): Promise<SeedSummary> {
  // Read before any database work, so a bad file fails while the transaction has done nothing.
  const relationshipFile = readDummyRelationships();
  const tables = await seedTables(tx, directory);
  const relationships = await applyIndicatorTopics(createDbFromTransaction(tx), relationshipFile);
  // Freshly loaded tables have no statistics, and the planner's guesses are wrong by enough
  // to turn an indexed observation lookup into a sequential scan over the whole table.
  await tx.unsafe(`ANALYZE ${analyzableTables()}`);
  return { tables, relationships };
}

/** Load the snapshot CSVs and public-profile-derived demo topic links. */
export async function seedPublishedTables(
  tx: postgres.TransactionSql,
  directory: string,
): Promise<SeedSummary> {
  const topicFile = parseIndicatorTopicFile(JSON.parse(readFileSync(publishedTopicFile, 'utf-8')));
  const tables = await seedTables(
    tx,
    directory,
    PUBLISHED_COPY_TIMEOUT_MS,
    PUBLISHED_COPY_TIMEOUT_MS,
  );
  const relationships = await applyIndicatorTopics(createDbFromTransaction(tx), topicFile);
  if (relationships.links === 0 || relationships.unknownTopics.length > 0) {
    throw new Error('Published topic mapping did not match the imported indicators and topics');
  }
  return { tables, relationships };
}

function analyzableTables(): string {
  return [...SEED_TABLES, 'indicator_topic', 'indicator_classification']
    .map((table) => `"${table}"`)
    .join(', ');
}

async function seedTables(
  tx: postgres.TransactionSql,
  directory: string,
  idleTimeoutMs = COPY_IDLE_TIMEOUT_MS,
  completionTimeoutMs = idleTimeoutMs,
): Promise<Record<string, number>> {
  const replaced = [...SEED_TABLES.filter((t) => t !== 'ci_method'), ...READ_MODEL_TABLES];
  await tx.unsafe(`TRUNCATE ${replaced.map((t) => `"${t}"`).join(', ')} CASCADE`);

  const counts: Record<string, number> = {};
  for (const table of SEED_TABLES) {
    if (table === 'ci_method') continue;

    if (table === 'indicator_version') {
      const loaded = await loadIndicatorVersions(tx, directory, idleTimeoutMs, completionTimeoutMs);
      counts.ci_method = loaded.ciMethods;
      counts.indicator_version = loaded.versions;
    } else {
      counts[table] = await loadTable(tx, table, directory, idleTimeoutMs, completionTimeoutMs);
    }
  }
  return counts;
}

/** Pholio's names for the CI methods the service names differently; the rest match as they are. */
const PHOLIO_CI_METHOD_NAMES: Record<string, string> = {
  'Normal approximation': 'Wald normal approximation',
  'Other method - see below': 'Other method',
};

/**
 * Loads the versions through staging tables, pointing each at the core CI method its source
 * method names, and answers how many rows each file held. The source's own method ids exist
 * nowhere else, so a direct COPY would break the foreign key; a method with no core
 * counterpart stops the load rather than being dropped.
 */
export async function loadIndicatorVersions(
  tx: postgres.TransactionSql,
  directory: string,
  idleTimeoutMs = COPY_IDLE_TIMEOUT_MS,
  completionTimeoutMs = idleTimeoutMs,
): Promise<{ ciMethods: number; versions: number }> {
  await tx`CREATE TEMP TABLE source_ci_method (id uuid, name text, description text) ON COMMIT DROP`;
  await tx`CREATE TEMP TABLE source_indicator_version (LIKE indicator_version INCLUDING DEFAULTS) ON COMMIT DROP`;
  const ciMethods = await loadTable(
    tx,
    'ci_method',
    directory,
    idleTimeoutMs,
    completionTimeoutMs,
    'source_ci_method',
  );
  await loadTable(
    tx,
    'indicator_version',
    directory,
    idleTimeoutMs,
    completionTimeoutMs,
    'source_indicator_version',
  );

  const sourceMethods = await tx<{ id: string; name: string }[]>`
    SELECT DISTINCT s.id, s.name FROM source_ci_method s
    JOIN source_indicator_version v ON v.ci_method_id = s.id
  `;
  const coreMethods = await tx<{ id: string; name: string }[]>`SELECT id, name FROM ci_method`;
  const coreIds = new Map(coreMethods.map(({ id, name }) => [name, id]));
  const mapping = sourceMethods.map(({ id, name }) => ({
    sourceId: id,
    coreId: coreIds.get(PHOLIO_CI_METHOD_NAMES[name] ?? name),
    name,
  }));
  const unmatched = mapping.filter(({ coreId }) => coreId === undefined).map(({ name }) => name);

  if (unmatched.length > 0) {
    throw new Error(
      `No core CI method for ${unmatched.join(', ')}: add it to data/ci-methods.json or map its name here, and run \`db import-core-data\``,
    );
  }

  await tx`CREATE TEMP TABLE source_ci_method_map (source_id uuid, core_id uuid) ON COMMIT DROP`;
  if (mapping.length > 0) {
    await tx`INSERT INTO source_ci_method_map ${tx(
      mapping.map(({ sourceId, coreId }) => ({ source_id: sourceId, core_id: coreId })),
    )}`;
  }

  const [dangling] = await tx<{ count: number }[]>`
    SELECT count(*)::int AS count FROM source_indicator_version v
    WHERE v.ci_method_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM source_ci_method_map m WHERE m.source_id = v.ci_method_id)
  `;

  if (dangling?.count) {
    throw new Error(`${dangling.count} seeded versions name a CI method the source does not hold`);
  }

  const columns = await readCsvHeader(`${directory}/indicator_version.csv.gz`);
  const columnList = columns.map((c) => `"${c}"`).join(', ');
  const selectList = columns
    .map((c) => (c === 'ci_method_id' ? 'm.core_id' : `v."${c}"`))
    .join(', ');
  const inserted = await tx.unsafe(`
    INSERT INTO indicator_version (${columnList})
    SELECT ${selectList} FROM source_indicator_version v
    LEFT JOIN source_ci_method_map m ON m.source_id = v.ci_method_id
  `);

  return { ciMethods, versions: inserted.count };
}
