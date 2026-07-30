import { z } from '@fphd/config';
import { asc, eq, inArray } from 'drizzle-orm';

import type { Database } from './client.js';
import { indicator, topic, topicIndicator } from './schema/index.js';

export const topicIndicatorFileSchema = z.object({
  topicIndicators: z.array(
    z.object({ topicSlug: z.string().min(1), fingertipsId: z.number().int() }),
  ),
  indicatorDataUpdatedAt: z.record(z.string(), z.iso.datetime({ local: true }).nullable()),
});

export type TopicIndicatorFile = z.infer<typeof topicIndicatorFileSchema>;

export interface TopicSummaryForIndicator {
  slug: string;
  title: string;
}

export interface TopicIndicatorImportSummary {
  links: number;
  timestamps: number;
  unknownTopics: string[];
  unknownIndicators: number[];
}

export function parseTopicIndicatorFile(data: unknown): TopicIndicatorFile {
  const result = topicIndicatorFileSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid topic indicator file:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}

/**
 * Replaces topic membership for the indicators named in the file, and records when the
 * source system last published their data. Membership is replaced rather than merged: the
 * file states what is true now, so a link it no longer carries should not survive.
 *
 * Rows naming a topic or indicator this database does not hold are reported rather than
 * failed on — a seed file and a database can legitimately drift while both are in flux.
 */
export async function importTopicIndicators(
  db: Database,
  file: TopicIndicatorFile,
): Promise<TopicIndicatorImportSummary> {
  const slugs = [...new Set(file.topicIndicators.map(({ topicSlug }) => topicSlug))];
  const fingertipsIds = [
    ...new Set([
      ...file.topicIndicators.map(({ fingertipsId }) => fingertipsId),
      ...Object.keys(file.indicatorDataUpdatedAt).map(Number),
    ]),
  ];

  const [topics, indicators] = await Promise.all([
    slugs.length > 0
      ? db.select({ id: topic.id, slug: topic.slug }).from(topic).where(inArray(topic.slug, slugs))
      : Promise.resolve([]),
    fingertipsIds.length > 0
      ? db
          .select({ id: indicator.id, fingertipsId: indicator.fingertipsId })
          .from(indicator)
          .where(inArray(indicator.fingertipsId, fingertipsIds))
      : Promise.resolve([]),
  ]);

  const topicIdBySlug = new Map(topics.map((row) => [row.slug, row.id]));
  const indicatorIdByFingertipsId = new Map(indicators.map((row) => [row.fingertipsId, row.id]));

  return db.transaction(async (tx) => {
    const links = file.topicIndicators.flatMap(({ topicSlug, fingertipsId }) => {
      const topicId = topicIdBySlug.get(topicSlug);
      const indicatorId = indicatorIdByFingertipsId.get(fingertipsId);
      return topicId && indicatorId ? [{ topicId, indicatorId }] : [];
    });

    const indicatorIds = [...new Set(links.map(({ indicatorId }) => indicatorId))];
    if (indicatorIds.length > 0) {
      await tx.delete(topicIndicator).where(inArray(topicIndicator.indicatorId, indicatorIds));
      await tx.insert(topicIndicator).values(links);
    }

    let timestamps = 0;
    for (const [fingertipsId, updatedAt] of Object.entries(file.indicatorDataUpdatedAt)) {
      const indicatorId = indicatorIdByFingertipsId.get(Number(fingertipsId));
      if (!indicatorId || !updatedAt) {
        continue;
      }
      await tx
        .update(indicator)
        .set({ dataUpdatedAt: new Date(`${updatedAt}Z`) })
        .where(eq(indicator.id, indicatorId));
      timestamps += 1;
    }

    return {
      links: links.length,
      timestamps,
      unknownTopics: slugs.filter((slug) => !topicIdBySlug.has(slug)),
      unknownIndicators: fingertipsIds.filter((id) => !indicatorIdByFingertipsId.has(id)),
    };
  });
}

/** The topics an indicator belongs to, ordered by title. */
export async function listTopicsForIndicator(
  db: Database,
  indicatorId: string,
): Promise<TopicSummaryForIndicator[]> {
  return db
    .select({ slug: topic.slug, title: topic.title })
    .from(topicIndicator)
    .innerJoin(topic, eq(topicIndicator.topicId, topic.id))
    .where(eq(topicIndicator.indicatorId, indicatorId))
    .orderBy(asc(topic.title));
}
