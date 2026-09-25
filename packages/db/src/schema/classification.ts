import { z } from '@fphd/config';
import { SLUG_PATTERN } from '@fphd/utils/slug';
import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { literals, timestamps, uuidPrimaryKey } from './helpers.ts';
import { indicatorVersion } from './indicator.ts';

export const CLASSIFICATION_DIMENSIONS = [
  'indicator_type',
  'population',
  'risk_factor',
  'inequality',
  'framework',
] as const;

export type ClassificationDimension = (typeof CLASSIFICATION_DIMENSIONS)[number];

/**
 * The ways an indicator is classified beyond its topic: what kind of measure it is, the
 * population it describes, the risk factor it relates to, the inequality it can be broken
 * down by, and the frameworks it reports into.
 *
 * One table rather than five, because the dimensions differ only in their vocabulary.
 * Adding one extends `CLASSIFICATION_DIMENSIONS`, with a migration for the check.
 */
export const classification = pgTable(
  'classification',
  {
    id: uuidPrimaryKey(),
    dimension: text({ enum: CLASSIFICATION_DIMENSIONS }).notNull(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [
    check(
      'classification_dimension_check',
      sql`${t.dimension} IN (${literals(CLASSIFICATION_DIMENSIONS)})`,
    ),
    index('idx_classification_dimension').on(t.dimension),
  ],
);

export const indicatorClassification = pgTable(
  'indicator_classification',
  {
    indicatorVersionId: uuid()
      .notNull()
      .references(() => indicatorVersion.id),
    classificationId: uuid()
      .notNull()
      .references(() => classification.id),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.indicatorVersionId, t.classificationId] }),
    index('idx_indicator_classification_classification').on(t.classificationId),
  ],
);

/**
 * A classification as the core data file states it. The slug is its key: seed and import
 * files name classifications by slug, and the row's id is the database's own.
 */
export const classificationRecordSchema = z.object({
  dimension: z.enum(CLASSIFICATION_DIMENSIONS),
  slug: z.string().min(1).regex(SLUG_PATTERN, 'slug must be lowercase, hyphen-separated words'),
  name: z.string().min(1),
});

export type ClassificationRecord = z.infer<typeof classificationRecordSchema>;
