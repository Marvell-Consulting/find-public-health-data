import { z } from '@fphd/config';
import { SLUG_PATTERN } from '@fphd/utils/slug';
import { foreignKey, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps, uuidPrimaryKey } from './helpers.ts';
import { indicatorVersion } from './indicator.ts';

export const topic = pgTable('topic', {
  id: uuidPrimaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  description: text().notNull(),
  ...timestamps,
});

/**
 * Which topics an indicator version belongs to. Many-to-many in both directions: an
 * indicator is reachable from several topics, and a topic lists many indicators.
 */
export const indicatorVersionTopic = pgTable(
  'indicator_version_topic',
  {
    indicatorVersionId: uuid().notNull(),
    topicId: uuid().notNull(),
  },
  (t) => [
    primaryKey({ name: 'indicator_version_topic_pk', columns: [t.indicatorVersionId, t.topicId] }),
    foreignKey({
      name: 'indicator_version_topic_version_fk',
      columns: [t.indicatorVersionId],
      foreignColumns: [indicatorVersion.id],
    }),
    foreignKey({
      name: 'indicator_version_topic_topic_fk',
      columns: [t.topicId],
      foreignColumns: [topic.id],
    }),
    index('idx_indicator_version_topic_topic').on(t.topicId),
  ],
);

/**
 * A topic as supplied by a caller (the import file today, publisher CRUD later).
 * Timestamps are deliberately absent — the database manages them.
 */
export const topicRecordSchema = z.object({
  id: z.uuidv7(),
  slug: z.string().min(1).regex(SLUG_PATTERN, 'slug must be lowercase, hyphen-separated words'),
  title: z.string().min(1),
  description: z.string().min(1),
});

export type TopicRecord = z.infer<typeof topicRecordSchema>;
