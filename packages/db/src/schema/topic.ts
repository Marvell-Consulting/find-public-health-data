import { z } from '@fphd/config';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps, uuidPrimaryKey } from './helpers.js';
import { indicator } from './indicator.js';

export const topic = pgTable('topic', {
  id: uuidPrimaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  description: text().notNull(),
  ...timestamps,
});

/**
 * Which topics an indicator belongs to. Many-to-many in both directions: an indicator is
 * reachable from several topics, and a topic lists many indicators.
 */
export const topicIndicator = pgTable(
  'topic_indicator',
  {
    topicId: uuid()
      .notNull()
      .references(() => topic.id),
    indicatorId: uuid()
      .notNull()
      .references(() => indicator.id),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.topicId, t.indicatorId] }),
    index('idx_topic_indicator_indicator').on(t.indicatorId),
  ],
);

/**
 * A topic as supplied by a caller (the import file today, publisher CRUD later).
 * Timestamps are deliberately absent — the database manages them.
 */
export const topicRecordSchema = z.object({
  id: z.uuidv7(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase, hyphen-separated words'),
  title: z.string().min(1),
  description: z.string().min(1),
});

export type TopicRecord = z.infer<typeof topicRecordSchema>;
