import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps, uuidPrimaryKey } from './helpers.js';
import { indicator } from './indicator.js';

/**
 * The ways an indicator is classified beyond its topic: what kind of measure it is, the
 * population it describes, the risk factor it relates to, the inequality it can be broken
 * down by, and the frameworks it reports into.
 *
 * One table rather than five, because the dimensions differ only in their vocabulary —
 * adding a sixth is a row, not a migration.
 */
export const classification = pgTable(
  'classification',
  {
    id: uuidPrimaryKey(),
    dimension: text().notNull(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [
    check(
      'classification_dimension_check',
      sql`${t.dimension} IN ('indicator_type', 'population', 'risk_factor', 'inequality', 'framework')`,
    ),
    index('idx_classification_dimension').on(t.dimension),
  ],
);

export const indicatorClassification = pgTable(
  'indicator_classification',
  {
    indicatorId: uuid()
      .notNull()
      .references(() => indicator.id),
    classificationId: uuid()
      .notNull()
      .references(() => classification.id),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.indicatorId, t.classificationId] }),
    index('idx_indicator_classification_classification').on(t.classificationId),
  ],
);
