import { asc, eq } from 'drizzle-orm';

import type { Database } from './client.ts';
import { indicatorTrendDirections } from './indicator-trends.ts';
import {
  publishedIndicator,
  publishedIndicatorTopic,
  publishedSubtopic,
  publishedTopic,
} from './schema/index.ts';

/** A topic as the public read surface serves it: no writers. */
export type Topic = typeof publishedTopic.$inferSelect;

/** All topics, ordered alphabetically by title. */
export async function listTopics(db: Database): Promise<Topic[]> {
  return db.select().from(publishedTopic).orderBy(asc(publishedTopic.title));
}

/** The topic with the given slug, or `undefined` if no topic matches. */
export async function getTopicBySlug(db: Database, slug: string): Promise<Topic | undefined> {
  const rows = await db.select().from(publishedTopic).where(eq(publishedTopic.slug, slug));
  return rows[0];
}

export async function listTopicSubtopics(db: Database, slug: string) {
  return db
    .select({ slug: publishedSubtopic.slug, title: publishedSubtopic.title })
    .from(publishedSubtopic)
    .innerJoin(publishedTopic, eq(publishedSubtopic.topicId, publishedTopic.id))
    .where(eq(publishedTopic.slug, slug))
    .orderBy(asc(publishedSubtopic.title));
}

export interface TopicTrendSummary {
  total: number;
  better: number;
  worse: number;
  unchanged: number;
  increasing: number;
  decreasing: number;
  unavailable: number;
}

/** Trend counts across the topic's published indicators for the England headline series. */
export async function getTopicTrendSummary(db: Database, slug: string): Promise<TopicTrendSummary> {
  const entries = await db
    .select({ id: publishedIndicator.id, polarity: publishedIndicator.polarity })
    .from(publishedIndicatorTopic)
    .innerJoin(publishedTopic, eq(publishedIndicatorTopic.topicId, publishedTopic.id))
    .innerJoin(publishedIndicator, eq(publishedIndicatorTopic.indicatorId, publishedIndicator.id))
    .where(eq(publishedTopic.slug, slug));
  const directions = await indicatorTrendDirections(
    db,
    entries.map(({ id }) => id),
  );
  const summary: TopicTrendSummary = {
    total: entries.length,
    better: 0,
    worse: 0,
    unchanged: 0,
    increasing: 0,
    decreasing: 0,
    unavailable: 0,
  };
  for (const { id, polarity } of entries) {
    const direction = directions.get(id);
    if (!direction) summary.unavailable++;
    else if (direction === 'right') summary.unchanged++;
    else if (polarity === 'higher-is-better' || polarity === 'lower-is-better') {
      const better = (direction === 'up') === (polarity === 'higher-is-better');
      if (better) summary.better++;
      else summary.worse++;
    } else if (direction === 'up') summary.increasing++;
    else summary.decreasing++;
  }
  return summary;
}
