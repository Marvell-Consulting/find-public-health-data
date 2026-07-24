import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { indicator } from './indicator.js';

export const uploadBatch = pgTable(
  'upload_batch',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    indicatorId: integer()
      .notNull()
      .references(() => indicator.id),
    originalFilename: text().notNull(),
    uploadedBy: text().notNull(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: text().notNull().default('received'),
    validationResult: jsonb(),
    supersededById: integer().references((): AnyPgColumn => uploadBatch.id),
  },
  (t) => [
    check(
      'upload_batch_status_check',
      sql`${t.status} IN ('received', 'validated', 'processed', 'failed', 'superseded')`,
    ),
  ],
);
