import { sql } from 'drizzle-orm';
import {
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { dimensionValue } from './dimension.js';
import { area } from './geography.js';
import { uuidPrimaryKey } from './helpers.js';
import { indicator } from './indicator.js';
import { uploadBatch } from './upload.js';

export const noteType = pgTable(
  'note_type',
  {
    id: uuidPrimaryKey(),
    text: text().notNull(),
    category: text().notNull(),
  },
  (t) => [
    check(
      'note_type_category_check',
      sql`${t.category} IN ('disclosure', 'quality', 'geographic', 'methodological', 'estimation', 'missing', 'contextual')`,
    ),
  ],
);

// Explicit column names where Drizzle's snake_case transform would drop the
// underscore before digits (denominator2 -> denominator2, lowerCi95 -> lower_ci95).
export const observation = pgTable(
  'observation',
  {
    id: uuidPrimaryKey(),
    indicatorId: uuid()
      .notNull()
      .references(() => indicator.id),
    areaId: uuid()
      .notNull()
      .references(() => area.id),
    fromDate: date().notNull(),
    toDate: date().notNull(),
    value: doublePrecision(),
    count: doublePrecision(),
    denominator: doublePrecision(),
    denominator2: doublePrecision('denominator_2'),
    lowerCi95: doublePrecision('lower_ci_95'),
    upperCi95: doublePrecision('upper_ci_95'),
    lowerCi998: doublePrecision('lower_ci_998'),
    upperCi998: doublePrecision('upper_ci_998'),
    distributionRank: smallint(),
    publishedAt: timestamp({ withTimezone: true }).notNull(),
    uploadBatchId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: text().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    // Pairing upload_batch_id with indicator_id guarantees an observation's batch
    // belongs to the same indicator the observation records.
    foreignKey({
      columns: [t.uploadBatchId, t.indicatorId],
      foreignColumns: [uploadBatch.id, uploadBatch.indicatorId],
      name: 'observation_upload_batch_indicator_fk',
    }),
    check('observation_date_order_check', sql`${t.fromDate} <= ${t.toDate}`),
    index('idx_obs_upload_batch').on(t.uploadBatchId),
    index('idx_obs_indicator_dates')
      .on(t.indicatorId, t.fromDate, t.toDate)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_obs_area_indicator').on(t.areaId, t.indicatorId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_obs_indicator_area_from')
      .on(t.indicatorId, t.areaId, t.fromDate)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_observation_area_from_indicator')
      .on(t.areaId, t.fromDate, t.indicatorId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

// dimension_type_id is denormalised onto the bridge so the database itself can
// enforce at most one value per dimension type per observation; the composite
// foreign key keeps it consistent with the referenced dimension value.
export const observationDimension = pgTable(
  'observation_dimension',
  {
    id: uuidPrimaryKey(),
    observationId: uuid()
      .notNull()
      .references(() => observation.id, { onDelete: 'cascade' }),
    dimensionValueId: uuid().notNull(),
    dimensionTypeId: uuid().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.dimensionValueId, t.dimensionTypeId],
      foreignColumns: [dimensionValue.id, dimensionValue.dimensionTypeId],
      name: 'observation_dimension_value_type_fk',
    }),
    unique().on(t.observationId, t.dimensionTypeId),
    index('idx_obs_dim_val_obs').on(t.dimensionValueId, t.observationId),
  ],
);

export const observationNote = pgTable(
  'observation_note',
  {
    id: uuidPrimaryKey(),
    observationId: uuid()
      .notNull()
      .references(() => observation.id, { onDelete: 'cascade' }),
    noteTypeId: uuid()
      .notNull()
      .references(() => noteType.id),
  },
  (t) => [unique().on(t.observationId, t.noteTypeId)],
);
