import { once } from 'node:events';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

import type postgres from 'postgres';

import { createOwnerClient } from './owner-client.js';

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

const seedDir = fileURLToPath(new URL('../../data/seed/', import.meta.url));

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

async function loadTable(sql: postgres.Sql, table: string): Promise<number> {
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

const sql = createOwnerClient();
try {
  const allTables = [...SEED_TABLES, ...READ_MODEL_TABLES].map((t) => `"${t}"`).join(', ');
  await sql.unsafe(`TRUNCATE ${allTables} RESTART IDENTITY CASCADE`);

  for (const table of SEED_TABLES) {
    const count = await loadTable(sql, table);
    console.log(`${table}: ${count} rows`);
  }

  for (const table of SEED_TABLES) {
    await sql`
      SELECT setval(
        pg_get_serial_sequence(${table}, 'id'),
        (SELECT COALESCE(MAX(id), 0) + 1 FROM ${sql(table)}),
        false
      )
    `;
  }
  console.log('Sequences resynced. Run db:rebuild-read-models to populate read models.');
} finally {
  await sql.end();
}
