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

import { uuidPrimaryKey } from './helpers.js';
import { indicator } from './indicator.js';

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
    status: text().notNull().default('received'),
    validationResult: jsonb(),
    supersededById: uuid().references((): AnyPgColumn => uploadBatch.id),
  },
  (t) => [
    check(
      'upload_batch_status_check',
      sql`${t.status} IN ('received', 'validated', 'processed', 'failed', 'superseded')`,
    ),
    // Target for observation's composite (batch, indicator) foreign key.
    unique().on(t.id, t.indicatorId),
  ],
);
