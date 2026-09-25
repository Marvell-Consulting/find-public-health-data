import { asc, eq } from 'drizzle-orm';

import type { Database } from './client.ts';
import {
  publishedClassification,
  publishedIndicatorClassification,
  publishedIndicatorTopic,
  publishedTopic,
} from './schema/index.ts';

export interface TopicSummaryForIndicator {
  slug: string;
  title: string;
}

export interface IndicatorClassification {
  dimension: string;
  slug: string;
  name: string;
}

/** The topics a published indicator belongs to, ordered by title. */
export async function listTopicsForIndicator(
  db: Database,
  indicatorId: string,
): Promise<TopicSummaryForIndicator[]> {
  return db
    .select({ slug: publishedTopic.slug, title: publishedTopic.title })
    .from(publishedIndicatorTopic)
    .innerJoin(publishedTopic, eq(publishedIndicatorTopic.topicId, publishedTopic.id))
    .where(eq(publishedIndicatorTopic.indicatorId, indicatorId))
    .orderBy(asc(publishedTopic.title));
}

/** A published indicator's classifications, grouped ready for the summary table. */
export async function listClassificationsForIndicator(
  db: Database,
  indicatorId: string,
): Promise<IndicatorClassification[]> {
  return db
    .select({
      dimension: publishedClassification.dimension,
      slug: publishedClassification.slug,
      name: publishedClassification.name,
    })
    .from(publishedIndicatorClassification)
    .innerJoin(
      publishedClassification,
      eq(publishedIndicatorClassification.classificationId, publishedClassification.id),
    )
    .where(eq(publishedIndicatorClassification.indicatorId, indicatorId))
    .orderBy(asc(publishedClassification.dimension), asc(publishedClassification.name));
}
