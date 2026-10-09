import { type Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { type Database, dimensionKey } from '@fphd/db';
import type { PendingQuery, TransactionSql } from 'postgres';

import { type DataTableEvent, readDataTable } from './data-table.ts';
import { createProblemTally } from './data-table-problems.ts';
import type { DataTableReferences, DataTableRow } from './data-table-rows.ts';
import { DATA_TABLE_PROBLEM_ITEMS, type DataTableProblem } from './data-upload-contract.ts';
import { loadDataTableReferences } from './data-upload-repository.ts';

// Scopes the per-draft upload locks within the two-key advisory lock space.
const UPLOAD_LOCK_NAMESPACE = 0x75706c64; // 'upld'

/** A stored file about to be processed into the batch named by `batchId`. */
export interface DataUpload {
  batchId: string;
  indicatorId: string;
  blobName: string;
  originalFilename: string;
  byteSize: number;
  sha256: string;
  actor: string;
}

export type ProcessDataUploadResult =
  | { ok: true; rowCount: number; replacedBlobName: string | null }
  | { ok: false; reason: 'invalid'; problems: DataTableProblem[] }
  | { ok: false; reason: 'no_draft' };

const STAGED_COLUMNS = [
  'line',
  'area_id',
  'from_date',
  'to_date',
  'value',
  'count',
  'denominator',
  'lower_ci_95',
  'upper_ci_95',
  'lower_ci_998',
  'upper_ci_998',
  'sex_id',
  'age_id',
  'category_id',
  'note_type_id',
  'dimension_key',
] as const;

/** A row in COPY's text format. Every value is an id, a date or a validated number. */
function stagedLine(row: DataTableRow): string {
  const dimensionIds = [row.sexId, row.ageId, row.categoryId].filter((id) => id !== null);
  const values = [
    String(row.line),
    row.areaId,
    row.fromDate,
    row.toDate,
    row.value,
    row.count,
    row.denominator,
    row.lower_ci_95,
    row.upper_ci_95,
    row.lower_ci_998,
    row.upper_ci_998,
    row.sexId,
    row.ageId,
    row.categoryId,
    row.noteTypeId,
    dimensionKey(dimensionIds),
  ];
  return `${values.map((value) => value ?? '\\N').join('\t')}\n`;
}

// Rows go to the database in chunks of about this many characters rather than one write each.
const COPY_CHUNK = 64 * 1024;

/**
 * Stores the file's rows under a new batch and points the draft at it, in one transaction
 * under a lock per draft, so concurrent uploads queue. A refused file keeps its batch, marked
 * failed with its problems, and loads nothing. On success the draft's previous batch is deleted
 * unless another version points at it; its blob name is returned for deleting after commit.
 */
export async function processDataUpload(
  db: Database,
  upload: DataUpload,
  openFile: () => Promise<Readable>,
  signal: AbortSignal,
): Promise<ProcessDataUploadResult> {
  const references = await loadDataTableReferences(db);

  try {
    return await loadInTransaction(db, upload, openFile, signal, references);
  } catch (error) {
    if (error instanceof DraftGoneError) return { ok: false, reason: 'no_draft' };
    throw error;
  }
}

/** The draft stopped being a draft while its upload loaded, so nothing is kept. */
class DraftGoneError extends Error {
  constructor() {
    super('The draft was no longer a draft when its upload finished loading');
    this.name = 'DraftGoneError';
  }
}

function loadInTransaction(
  db: Database,
  upload: DataUpload,
  openFile: () => Promise<Readable>,
  signal: AbortSignal,
  references: DataTableReferences,
): Promise<ProcessDataUploadResult> {
  return db.$client.begin(async (tx): Promise<ProcessDataUploadResult> => {
    await tx`SELECT pg_advisory_xact_lock(${UPLOAD_LOCK_NAMESPACE}, hashtext(${upload.indicatorId}))`;

    // Not locked: the upload lock queues the only other writer of the pointer, and section saves
    // on the draft carry on while the file loads.
    const [draft] = await tx<{ id: string; uploadBatchId: string | null }[]>`
      SELECT id, upload_batch_id AS "uploadBatchId"
      FROM indicator_version
      WHERE indicator_id = ${upload.indicatorId} AND status = 'draft'`;

    if (draft === undefined) return { ok: false, reason: 'no_draft' };

    await tx`
      INSERT INTO upload_batch
        (id, indicator_id, indicator_version_id, original_filename, uploaded_by, blob_name, byte_size, sha256)
      VALUES (${upload.batchId}, ${upload.indicatorId}, ${draft.id}, ${upload.originalFilename},
        ${upload.actor}, ${upload.blobName}, ${upload.byteSize}, ${upload.sha256})`;

    const staged = await stageRows(tx, readDataTable(await openFile(), references), signal);
    const problems = [...staged.problems, ...(await duplicateRows(tx, signal))];

    if (problems.length > 0) {
      // Drizzle's client passes json parameters through unserialised, so they are sent as text.
      await tx`
        UPDATE upload_batch
        SET status = 'failed', validation_result = ${JSON.stringify(problems)}::jsonb, column_names = ${staged.columnNames}
        WHERE id = ${upload.batchId}`;
      return { ok: false, reason: 'invalid', problems };
    }

    await loadStagedRows(tx, upload, signal);
    await tx`
      UPDATE upload_batch
      SET status = 'processed', row_count = ${staged.rowCount}, column_names = ${staged.columnNames}
      WHERE id = ${upload.batchId}`;
    const pointed = await tx`
      UPDATE indicator_version
      SET upload_batch_id = ${upload.batchId}, data_table_confirmed_at = NULL,
        updated_at = now(), updated_by = ${upload.actor}
      WHERE id = ${draft.id} AND status = 'draft'`;
    if (pointed.count === 0) throw new DraftGoneError();

    const replacedBlobName =
      draft.uploadBatchId === null
        ? null
        : await deleteReplacedBatch(tx, draft.uploadBatchId, draft.id, signal);
    // Abandoned after its last statement, the upload still rolls back rather than commit.
    signal.throwIfAborted();

    return { ok: true, rowCount: staged.rowCount, replacedBlobName };
  });
}

/** Streams the readable rows into a temporary table and tallies everything wrong with the rest. */
export async function stageRows(
  tx: TransactionSql,
  events: AsyncIterable<DataTableEvent>,
  signal: AbortSignal,
): Promise<{ rowCount: number; columnNames: string[]; problems: DataTableProblem[] }> {
  await tx`
    CREATE TEMPORARY TABLE upload_row (
      id uuid NOT NULL DEFAULT uuidv7(),
      line integer NOT NULL,
      area_id uuid NOT NULL,
      from_date date NOT NULL,
      to_date date NOT NULL,
      value double precision,
      count double precision,
      denominator double precision,
      lower_ci_95 double precision,
      upper_ci_95 double precision,
      lower_ci_998 double precision,
      upper_ci_998 double precision,
      sex_id uuid,
      age_id uuid,
      category_id uuid,
      note_type_id uuid,
      dimension_key text NOT NULL
    ) ON COMMIT DROP`;

  const copy = await tx`COPY upload_row (${tx(STAGED_COLUMNS)}) FROM STDIN`.writable();
  const tally = createProblemTally();
  let rowCount = 0;
  let columnNames: string[] = [];

  await pipeline(
    events,
    async function* (source: AsyncIterable<DataTableEvent>) {
      let chunk = '';
      for await (const event of source) {
        if (event.kind === 'columns') {
          columnNames = event.names;
        } else if (event.kind === 'finding') {
          tally.add(event.finding);
        } else {
          rowCount += 1;
          chunk += stagedLine(event.row);
          if (chunk.length >= COPY_CHUNK) {
            yield chunk;
            chunk = '';
          }
        }
      }
      if (chunk !== '') yield chunk;
    },
    endedUnawaited(copy),
    { signal },
  );

  // Runs once the COPY has, so it fails if the server refused the rows.
  try {
    await tx`SELECT 1`;
  } catch (error) {
    throw new Error('The rows could not be copied into the staging table', { cause: error });
  }

  return { rowCount, columnNames, problems: tally.problems() };
}

/**
 * Writes through to a COPY stream and ends it without waiting for it to finish: postgres.js
 * drops a refusal the server sends after the last write, and the stream then never finishes.
 */
function endedUnawaited(copy: Writable): Writable {
  const writer = new Writable({
    write(chunk, _encoding, callback) {
      copy.write(chunk, callback);
    },
    final(callback) {
      copy.end();
      callback();
    },
    destroy(error, callback) {
      // An abandoned upload fails the COPY; a finished one leaves it be.
      if (error !== null) copy.destroy(error);
      callback(error);
    },
  });
  copy.on('error', (error) => writer.destroy(error));
  return writer;
}

/**
 * Runs a statement that an abandoned upload cancels on the server, so a long insert or delete
 * stops and the transaction rolls back rather than running to its end first.
 */
export async function cancellable<T extends readonly (object | undefined)[]>(
  signal: AbortSignal,
  query: PendingQuery<T>,
): Promise<T> {
  signal.throwIfAborted();
  const cancel = () => {
    query.cancel();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    return await query;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

/** Rows repeating an earlier row's area, period and dimension values: the natural key. */
async function duplicateRows(tx: TransactionSql, signal: AbortSignal): Promise<DataTableProblem[]> {
  const query = tx<{ line: number; total: string }[]>`
    SELECT line, count(*) OVER () AS total
    FROM (
      SELECT line, row_number() OVER (
        PARTITION BY area_id, from_date, to_date, dimension_key ORDER BY line
      ) AS occurrence
      FROM upload_row
    ) r
    WHERE occurrence > 1
    ORDER BY line
    LIMIT ${DATA_TABLE_PROBLEM_ITEMS}`;
  const repeats = await cancellable(signal, query);

  const [first] = repeats;
  if (first === undefined) return [];

  return [
    {
      code: 'duplicate_rows',
      items: repeats.map(({ line }) => String(line)),
      count: Number(first.total),
    },
  ];
}

async function loadStagedRows(
  tx: TransactionSql,
  upload: DataUpload,
  signal: AbortSignal,
): Promise<void> {
  const observations = tx`
    INSERT INTO observation (
      id, indicator_id, area_id, from_date, to_date, value, count, denominator,
      lower_ci_95, upper_ci_95, lower_ci_998, upper_ci_998, upload_batch_id, dimension_key, created_by
    )
    SELECT
      id, ${upload.indicatorId}, area_id, from_date, to_date, value, count, denominator,
      lower_ci_95, upper_ci_95, lower_ci_998, upper_ci_998, ${upload.batchId}, dimension_key, ${upload.actor}
    FROM upload_row`;
  const dimensions = tx`
    INSERT INTO observation_dimension (observation_id, dimension_value_id, dimension_type_id)
    SELECT r.id, dv.id, dv.dimension_type_id
    FROM upload_row r
    CROSS JOIN LATERAL (VALUES (r.sex_id), (r.age_id), (r.category_id)) AS v (id)
    JOIN dimension_value dv ON dv.id = v.id`;
  const notes = tx`
    INSERT INTO observation_note (observation_id, note_type_id)
    SELECT id, note_type_id FROM upload_row WHERE note_type_id IS NOT NULL`;

  // Each is sent only when awaited, so they run in turn.
  for (const statement of [observations, dimensions, notes]) {
    await cancellable(signal, statement);
  }
}

/**
 * Deletes the batch the draft pointed at before, with its rows, when the draft uploaded it and
 * no version points at it now, and answers its blob name. The published batch an update draft
 * started from is kept.
 */
async function deleteReplacedBatch(
  tx: TransactionSql,
  batchId: string,
  draftId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const [replaced] = await tx<{ blobName: string | null }[]>`
    SELECT blob_name AS "blobName"
    FROM upload_batch b
    WHERE b.id = ${batchId}
      AND b.indicator_version_id = ${draftId}
      AND NOT EXISTS (SELECT 1 FROM indicator_version v WHERE v.upload_batch_id = b.id)`;

  if (replaced === undefined) return null;

  await cancellable(signal, tx`DELETE FROM observation WHERE upload_batch_id = ${batchId}`);
  await cancellable(signal, tx`DELETE FROM upload_batch WHERE id = ${batchId}`);

  return replaced.blobName;
}
