import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { type Database, dimensionKey } from '@fphd/db';
import type { TransactionSql } from 'postgres';

import { type DataTableEvent, readDataTable } from './data-table.ts';
import { createProblemTally } from './data-table-problems.ts';
import type { DataTableRow } from './data-table-rows.ts';
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

  return db.$client.begin(async (tx): Promise<ProcessDataUploadResult> => {
    await tx`SELECT pg_advisory_xact_lock(${UPLOAD_LOCK_NAMESPACE}, hashtext(${upload.indicatorId}))`;

    const [draft] = await tx<{ id: string; uploadBatchId: string | null }[]>`
      SELECT id, upload_batch_id AS "uploadBatchId"
      FROM indicator_version
      WHERE indicator_id = ${upload.indicatorId} AND status = 'draft'
      FOR UPDATE`;

    if (draft === undefined) return { ok: false, reason: 'no_draft' };

    await tx`
      INSERT INTO upload_batch
        (id, indicator_id, indicator_version_id, original_filename, uploaded_by, blob_name, byte_size, sha256)
      VALUES (${upload.batchId}, ${upload.indicatorId}, ${draft.id}, ${upload.originalFilename},
        ${upload.actor}, ${upload.blobName}, ${upload.byteSize}, ${upload.sha256})`;

    const staged = await stageRows(tx, readDataTable(await openFile(), references), signal);
    const problems = [...staged.problems, ...(await duplicateRows(tx))];
    // Each step below runs to its end, so an abandoned upload is caught between them.
    signal.throwIfAborted();

    if (problems.length > 0) {
      // Drizzle's client passes json parameters through unserialised, so they are sent as text.
      await tx`
        UPDATE upload_batch
        SET status = 'failed', validation_result = ${JSON.stringify(problems)}::jsonb, column_names = ${staged.columnNames}
        WHERE id = ${upload.batchId}`;
      return { ok: false, reason: 'invalid', problems };
    }

    await loadStagedRows(tx, upload);
    signal.throwIfAborted();
    await tx`
      UPDATE upload_batch
      SET status = 'processed', row_count = ${staged.rowCount}, column_names = ${staged.columnNames}
      WHERE id = ${upload.batchId}`;
    await tx`
      UPDATE indicator_version
      SET upload_batch_id = ${upload.batchId}, data_table_confirmed_at = NULL,
        updated_at = now(), updated_by = ${upload.actor}
      WHERE id = ${draft.id}`;

    const replacedBlobName =
      draft.uploadBatchId === null
        ? null
        : await deleteReplacedBatch(tx, draft.uploadBatchId, draft.id);
    signal.throwIfAborted();

    return { ok: true, rowCount: staged.rowCount, replacedBlobName };
  });
}

/** Streams the readable rows into a temporary table and tallies everything wrong with the rest. */
async function stageRows(
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
    copy,
    { signal },
  );

  return { rowCount, columnNames, problems: tally.problems() };
}

/** Rows repeating an earlier row's area, period and dimension values: the natural key. */
async function duplicateRows(tx: TransactionSql): Promise<DataTableProblem[]> {
  const repeats = await tx<{ line: number; total: string }[]>`
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

async function loadStagedRows(tx: TransactionSql, upload: DataUpload): Promise<void> {
  await tx`
    INSERT INTO observation (
      id, indicator_id, area_id, from_date, to_date, value, count, denominator,
      lower_ci_95, upper_ci_95, lower_ci_998, upper_ci_998, upload_batch_id, dimension_key, created_by
    )
    SELECT
      id, ${upload.indicatorId}, area_id, from_date, to_date, value, count, denominator,
      lower_ci_95, upper_ci_95, lower_ci_998, upper_ci_998, ${upload.batchId}, dimension_key, ${upload.actor}
    FROM upload_row`;
  await tx`
    INSERT INTO observation_dimension (observation_id, dimension_value_id, dimension_type_id)
    SELECT r.id, dv.id, dv.dimension_type_id
    FROM upload_row r
    CROSS JOIN LATERAL (VALUES (r.sex_id), (r.age_id), (r.category_id)) AS v (id)
    JOIN dimension_value dv ON dv.id = v.id`;
  await tx`
    INSERT INTO observation_note (observation_id, note_type_id)
    SELECT id, note_type_id FROM upload_row WHERE note_type_id IS NOT NULL`;
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
): Promise<string | null> {
  const [replaced] = await tx<{ blobName: string | null }[]>`
    SELECT blob_name AS "blobName"
    FROM upload_batch b
    WHERE b.id = ${batchId}
      AND b.indicator_version_id = ${draftId}
      AND NOT EXISTS (SELECT 1 FROM indicator_version v WHERE v.upload_batch_id = b.id)`;

  if (replaced === undefined) return null;

  await tx`DELETE FROM observation WHERE upload_batch_id = ${batchId}`;
  await tx`DELETE FROM upload_batch WHERE id = ${batchId}`;

  return replaced.blobName;
}
