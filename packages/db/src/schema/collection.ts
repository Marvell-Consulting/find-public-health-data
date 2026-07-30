import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps, uuidPrimaryKey } from './helpers.js';
import { indicator } from './indicator.js';

/**
 * A named grouping of indicators. Fingertips calls its groupings "profiles" and is
 * retiring them in favour of tag-based grouping, so the source is recorded per row
 * rather than assumed: the table can carry profile-derived groupings today and
 * editorially-owned ones later without a second relationship to maintain.
 */
export const collection = pgTable(
  'collection',
  {
    id: uuidPrimaryKey(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    // Where the grouping came from — 'fingertips-profile' for imported profiles.
    source: text().notNull(),
    // The identifier this grouping has in its source system, for re-import and audit.
    sourceRef: text(),
    ...timestamps,
  },
  (t) => [index('idx_collection_source').on(t.source)],
);

export const indicatorCollection = pgTable(
  'indicator_collection',
  {
    indicatorId: uuid()
      .notNull()
      .references(() => indicator.id),
    collectionId: uuid()
      .notNull()
      .references(() => collection.id),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.indicatorId, t.collectionId] }),
    index('idx_indicator_collection_collection').on(t.collectionId),
  ],
);
