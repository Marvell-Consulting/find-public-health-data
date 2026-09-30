import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { literals, uuidPrimaryKey } from './helpers.ts';
import { indicator } from './indicator.ts';

/** Where an upload stands, from receipt to processing or replacement. */
export const UPLOAD_BATCH_STATUSES = [
  'received',
  'validated',
  'processed',
  'failed',
  'superseded',
] as const;

export const uploadBatch = pgTable(
  'upload_batch',
  {
    id: uuidPrimaryKey(),
    indicatorId: uuid()
      .notNull()
      .references(() => indicator.id),
    originalFilename: text().notNull(),
    uploadedBy: text().notNull(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: text({ enum: UPLOAD_BATCH_STATUSES }).notNull().default('received'),
    validationResult: jsonb(),
    supersededById: uuid().references((): AnyPgColumn => uploadBatch.id),
  },
  (t) => [
    check('upload_batch_status_check', sql`${t.status} IN (${literals(UPLOAD_BATCH_STATUSES)})`),
    // Target for observation's composite (batch, indicator) foreign key.
    unique().on(t.id, t.indicatorId),
  ],
);
