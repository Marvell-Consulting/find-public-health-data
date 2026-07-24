import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

import { dimensionValue } from './dimension.js';
import { area } from './geography.js';
import { indicator } from './indicator.js';
import { uploadBatch } from './upload.js';

export const noteType = pgTable(
  'note_type',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
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
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    indicatorId: integer()
      .notNull()
      .references(() => indicator.id),
    areaId: integer()
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
    uploadBatchId: integer()
      .notNull()
      .references(() => uploadBatch.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: text().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
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

export const observationDimension = pgTable(
  'observation_dimension',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    observationId: bigint({ mode: 'number' })
      .notNull()
      .references(() => observation.id, { onDelete: 'cascade' }),
    dimensionValueId: integer()
      .notNull()
      .references(() => dimensionValue.id),
  },
  (t) => [
    unique().on(t.observationId, t.dimensionValueId),
    index('idx_obs_dim_obs_val').on(t.observationId, t.dimensionValueId),
    index('idx_obs_dim_val_obs').on(t.dimensionValueId, t.observationId),
  ],
);

export const observationNote = pgTable(
  'observation_note',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    observationId: bigint({ mode: 'number' })
      .notNull()
      .references(() => observation.id, { onDelete: 'cascade' }),
    noteTypeId: integer()
      .notNull()
      .references(() => noteType.id),
  },
  (t) => [unique().on(t.observationId, t.noteTypeId)],
);
