import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  type PgTableExtraConfigValue,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { literals, uuidPrimaryKey } from './helpers.ts';
import { indicator, indicatorVersion } from './indicator.ts';

/** Where an upload stands, from receipt to processing or replacement. */
export const UPLOAD_BATCH_STATUSES = [
  'received',
  'validated',
  'processed',
  'failed',
  'superseded',
] as const;

export type UploadBatchStatus = (typeof UPLOAD_BATCH_STATUSES)[number];

/** How an upload's rows relate to the data before it: a replacement holds the whole data set. */
export const UPLOAD_BATCH_KINDS = ['replace'] as const;

export type UploadBatchKind = (typeof UPLOAD_BATCH_KINDS)[number];

export const uploadBatch = pgTable(
  'upload_batch',
  {
    id: uuidPrimaryKey(),
    indicatorId: uuid()
      .notNull()
      .references(() => indicator.id),
    // The version it was uploaded to, which keeps it even when no version points at it.
    indicatorVersionId: uuid().notNull(),
    originalFilename: text().notNull(),
    uploadedBy: text().notNull(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: text({ enum: UPLOAD_BATCH_STATUSES }).notNull().default('received'),
    validationResult: jsonb(),
    supersededById: uuid().references((): AnyPgColumn => uploadBatch.id),
    blobName: text(),
    byteSize: bigint({ mode: 'number' }),
    sha256: text(),
    rowCount: integer(),
    columnNames: text().array(),
    kind: text({ enum: UPLOAD_BATCH_KINDS }).notNull().default('replace'),
    // The batch an append or correction applies its file to.
    baseBatchId: uuid().references((): AnyPgColumn => uploadBatch.id),
  },
  // Annotated because indicator_version's foreign key refers back to this table.
  (t): PgTableExtraConfigValue[] => [
    check('upload_batch_status_check', sql`${t.status} IN (${literals(UPLOAD_BATCH_STATUSES)})`),
    check('upload_batch_kind_check', sql`${t.kind} IN (${literals(UPLOAD_BATCH_KINDS)})`),
    check(
      'upload_batch_base_batch_check',
      sql`${t.kind} <> ${literals(['replace' satisfies UploadBatchKind])} OR ${t.baseBatchId} IS NULL`,
    ),
    check(
      'upload_batch_superseded_check',
      sql`(${t.status} = ${literals(['superseded' satisfies UploadBatchStatus])}) = (${t.supersededById} IS NOT NULL)`,
    ),
    check('upload_batch_sha256_check', sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
    // Target for the composite (batch, indicator) foreign keys of observation and indicator_version.
    unique().on(t.id, t.indicatorId),
    // Pairing the version with indicator_id keeps a batch on a version of its own indicator.
    foreignKey({
      columns: [t.indicatorVersionId, t.indicatorId],
      foreignColumns: [indicatorVersion.id, indicatorVersion.indicatorId],
      name: 'upload_batch_indicator_version_fk',
    }),
    index('idx_upload_batch_indicator_version').on(t.indicatorVersionId),
  ],
);
