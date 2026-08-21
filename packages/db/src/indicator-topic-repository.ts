import { z } from '@fphd/config';
import { asc, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import {
  classification,
  indicator,
  indicatorClassification,
  indicatorTopic,
  topic,
} from './schema/index.js';

/**
 * Three files rather than one, because they are three unrelated concerns: which topics an
 * indicator sits under, how it is classified, and when its data was last published. Topics
 * are referenced by id — a slug is a label that may be rewritten, the id is the row.
 */
export const indicatorTopicFileSchema = z.object({
  indicatorTopics: z
    .array(z.object({ topicId: z.uuidv7(), fingertipsId: z.number().int() }))
    .default([]),
  indicatorDataUpdatedAt: z
    .record(z.string(), z.iso.datetime({ local: true }).nullable())
    .default({}),
  classifications: z
    .array(
      z.object({
        slug: z.string().min(1),
        dimension: z.enum([
          'indicator_type',
          'population',
          'risk_factor',
          'inequality',
          'framework',
        ]),
        name: z.string().min(1),
      }),
    )
    .default([]),
  indicatorClassifications: z
    .array(z.object({ fingertipsId: z.number().int(), classificationSlug: z.string().min(1) }))
    .default([]),
});

export type IndicatorTopicFile = z.infer<typeof indicatorTopicFileSchema>;

export interface TopicSummaryForIndicator {
  slug: string;
  title: string;
}

export interface IndicatorClassification {
  dimension: string;
  slug: string;
  name: string;
}

export interface IndicatorTopicImportSummary {
  classifications: number;
  classificationLinks: number;
  links: number;
  timestamps: number;
  unknownTopics: string[];
  unknownIndicators: number[];
}

export function parseIndicatorTopicFile(data: unknown): IndicatorTopicFile {
  const result = indicatorTopicFileSchema.safeParse(data);

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
 *
 * Runs several statements without opening a transaction, so the caller owns atomicity —
 * the dummy seed applies this inside the same transaction as the tables it loads.
 */
export async function applyIndicatorTopics(
  db: Database,
  file: IndicatorTopicFile,
): Promise<IndicatorTopicImportSummary> {
  const topicIds = [...new Set(file.indicatorTopics.map(({ topicId }) => topicId))];
  const fingertipsIds = [
    ...new Set([
      ...file.indicatorTopics.map(({ fingertipsId }) => fingertipsId),
      ...Object.keys(file.indicatorDataUpdatedAt).map(Number),
    ]),
  ];

  const [topics, indicators] = await Promise.all([
    topicIds.length > 0
      ? db.select({ id: topic.id }).from(topic).where(inArray(topic.id, topicIds))
      : Promise.resolve([]),
    fingertipsIds.length > 0
      ? db
          .select({ id: indicator.id, fingertipsId: indicator.fingertipsId })
          .from(indicator)
          .where(inArray(indicator.fingertipsId, fingertipsIds))
      : Promise.resolve([]),
  ]);

  const knownTopicIds = new Set(topics.map((row) => row.id));
  const indicatorIdByFingertipsId = new Map(indicators.map((row) => [row.fingertipsId, row.id]));

  const links = file.indicatorTopics.flatMap(({ topicId, fingertipsId }) => {
    const indicatorId = indicatorIdByFingertipsId.get(fingertipsId);
    return knownTopicIds.has(topicId) && indicatorId ? [{ topicId, indicatorId }] : [];
  });

  const indicatorIds = [...new Set(links.map(({ indicatorId }) => indicatorId))];
  if (indicatorIds.length > 0) {
    await db.delete(indicatorTopic).where(inArray(indicatorTopic.indicatorId, indicatorIds));
    await db.insert(indicatorTopic).values(links);
  }

  let timestamps = 0;
  for (const [fingertipsId, updatedAt] of Object.entries(file.indicatorDataUpdatedAt)) {
    const indicatorId = indicatorIdByFingertipsId.get(Number(fingertipsId));
    if (!indicatorId || !updatedAt) {
      continue;
    }
    await db
      .update(indicator)
      .set({ dataUpdatedAt: new Date(`${updatedAt}Z`) })
      .where(eq(indicator.id, indicatorId));
    timestamps += 1;
  }

  let classificationCount = 0;
  let classificationLinks = 0;
  if (file.classifications.length > 0) {
    const stored = await db
      .insert(classification)
      .values(file.classifications)
      .onConflictDoUpdate({
        target: classification.slug,
        set: {
          name: sql`excluded.name`,
          dimension: sql`excluded.dimension`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: classification.id, slug: classification.slug });
    classificationCount = stored.length;
    const idBySlug = new Map(stored.map((row) => [row.slug, row.id]));

    const rows = file.indicatorClassifications.flatMap(({ fingertipsId, classificationSlug }) => {
      const indicatorId = indicatorIdByFingertipsId.get(fingertipsId);
      const classificationId = idBySlug.get(classificationSlug);
      return indicatorId && classificationId ? [{ indicatorId, classificationId }] : [];
    });
    const classified = [...new Set(rows.map(({ indicatorId }) => indicatorId))];
    if (classified.length > 0) {
      await db
        .delete(indicatorClassification)
        .where(inArray(indicatorClassification.indicatorId, classified));
      await db.insert(indicatorClassification).values(rows);
    }
    classificationLinks = rows.length;
  }

  return {
    classifications: classificationCount,
    classificationLinks,
    links: links.length,
    timestamps,
    unknownTopics: topicIds.filter((id) => !knownTopicIds.has(id)),
    unknownIndicators: fingertipsIds.filter((id) => !indicatorIdByFingertipsId.has(id)),
  };
}

/** The topics an indicator belongs to, ordered by title. */
export async function listTopicsForIndicator(
  db: Database,
  indicatorId: string,
): Promise<TopicSummaryForIndicator[]> {
  return db
    .select({ slug: topic.slug, title: topic.title })
    .from(indicatorTopic)
    .innerJoin(topic, eq(indicatorTopic.topicId, topic.id))
    .where(eq(indicatorTopic.indicatorId, indicatorId))
    .orderBy(asc(topic.title));
}

/** An indicator's classifications, grouped ready for the summary table. */
export async function listClassificationsForIndicator(
  db: Database,
  indicatorId: string,
): Promise<IndicatorClassification[]> {
  return db
    .select({
      dimension: classification.dimension,
      slug: classification.slug,
      name: classification.name,
    })
    .from(indicatorClassification)
    .innerJoin(classification, eq(indicatorClassification.classificationId, classification.id))
    .where(eq(indicatorClassification.indicatorId, indicatorId))
    .orderBy(asc(classification.dimension), asc(classification.name));
}
