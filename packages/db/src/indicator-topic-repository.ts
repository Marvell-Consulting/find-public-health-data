import { z } from '@fphd/config';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Database } from './client.ts';
import {
  classification,
  currentPublishedVersion,
  indicator,
  indicatorClassification,
  indicatorTopic,
  indicatorVersion,
  publishedClassification,
  publishedIndicatorClassification,
  publishedIndicatorTopic,
  publishedTopic,
  topic,
} from './schema/index.ts';

/**
 * Three files rather than one, because they are three unrelated concerns: which topics an
 * indicator sits under, how it is classified, and when its data was last published. Topics
 * are referenced by id — a slug is a label that may be rewritten, the id is the row.
 * Indicators are referenced by their Fingertips number, which these exports carry and which
 * resolves against short_id.
 */
export const indicatorTopicFileSchema = z.object({
  indicatorTopics: z
    .array(z.object({ topicId: z.uuidv7(), fingertipsId: z.number().int() }))
    .default([]),
  indicatorDataUpdatedAt: z
    .record(z.string(), z.iso.datetime({ local: true }).nullable())
    .default({}),
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
  classificationLinks: number;
  links: number;
  timestamps: number;
  unknownTopics: string[];
  unknownClassifications: string[];
  unknownIndicators: number[];
}

const draftVersion = alias(indicatorVersion, 'draft_version');

export function parseIndicatorTopicFile(data: unknown): IndicatorTopicFile {
  const result = indicatorTopicFileSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid topic indicator file:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}

/**
 * Replaces the topic memberships and classifications of the indicators the file names, and
 * records when the source system last published their data. A membership belongs to a version: the
 * published one if the indicator has one, otherwise its draft. Memberships are replaced,
 * not merged, because the file states what is true now.
 *
 * Rows naming a topic, classification or indicator this database does not hold are reported rather than
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
  const shortIds = [
    ...new Set([
      ...file.indicatorTopics.map(({ fingertipsId }) => fingertipsId),
      ...file.indicatorClassifications.map(({ fingertipsId }) => fingertipsId),
      ...Object.keys(file.indicatorDataUpdatedAt).map(Number),
    ]),
  ];

  const [topics, indicators] = await Promise.all([
    topicIds.length > 0
      ? db.select({ id: topic.id }).from(topic).where(inArray(topic.id, topicIds))
      : Promise.resolve([]),
    shortIds.length > 0
      ? db
          .select({
            id: indicator.id,
            shortId: indicator.shortId,
            versionId: sql<
              string | null
            >`coalesce(${currentPublishedVersion.id}, ${draftVersion.id})`,
          })
          .from(indicator)
          .leftJoin(currentPublishedVersion, eq(currentPublishedVersion.indicatorId, indicator.id))
          .leftJoin(
            draftVersion,
            and(eq(draftVersion.indicatorId, indicator.id), eq(draftVersion.status, 'draft')),
          )
          .where(inArray(indicator.shortId, shortIds))
      : Promise.resolve([]),
  ]);

  const knownTopicIds = new Set(topics.map((row) => row.id));
  const indicatorIdByShortId = new Map(indicators.map((row) => [row.shortId, row.id]));
  const versionIdByShortId = new Map(
    indicators.flatMap((row) => (row.versionId === null ? [] : [[row.shortId, row.versionId]])),
  );

  const links = file.indicatorTopics.flatMap(({ topicId, fingertipsId }) => {
    const indicatorVersionId = versionIdByShortId.get(fingertipsId);
    return knownTopicIds.has(topicId) && indicatorVersionId
      ? [{ topicId, indicatorVersionId }]
      : [];
  });

  const versionIds = [...new Set(links.map(({ indicatorVersionId }) => indicatorVersionId))];
  if (versionIds.length > 0) {
    await db.delete(indicatorTopic).where(inArray(indicatorTopic.indicatorVersionId, versionIds));
    await db.insert(indicatorTopic).values(links);
  }

  let timestamps = 0;
  for (const [fingertipsId, updatedAt] of Object.entries(file.indicatorDataUpdatedAt)) {
    const indicatorId = indicatorIdByShortId.get(Number(fingertipsId));
    if (!indicatorId || !updatedAt) {
      continue;
    }
    await db
      .update(indicator)
      .set({ dataUpdatedAt: new Date(`${updatedAt}Z`) })
      .where(eq(indicator.id, indicatorId));
    timestamps += 1;
  }

  const classificationLinks = await applyIndicatorClassifications(
    db,
    file.indicatorClassifications,
    versionIdByShortId,
  );

  return {
    classificationLinks: classificationLinks.links,
    links: links.length,
    timestamps,
    unknownTopics: topicIds.filter((id) => !knownTopicIds.has(id)),
    unknownClassifications: classificationLinks.unknownSlugs,
    unknownIndicators: shortIds.filter((id) => !indicatorIdByShortId.has(id)),
  };
}

/**
 * Replaces the classifications of the versions the rows name, which name classifications by
 * the slug the core data gives them. A version given a risk factor or a framework has
 * answered yes to having one; any other is left unanswered, as the source never asked.
 */
async function applyIndicatorClassifications(
  db: Database,
  rows: IndicatorTopicFile['indicatorClassifications'],
  versionIdByShortId: ReadonlyMap<number, string>,
): Promise<{ links: number; unknownSlugs: string[] }> {
  const slugs = [...new Set(rows.map(({ classificationSlug }) => classificationSlug))];
  const known =
    slugs.length > 0
      ? await db
          .select({
            id: classification.id,
            slug: classification.slug,
            dimension: classification.dimension,
          })
          .from(classification)
          .where(inArray(classification.slug, slugs))
      : [];
  const bySlug = new Map(known.map((row) => [row.slug, row]));

  const links = rows.flatMap(({ fingertipsId, classificationSlug }) => {
    const indicatorVersionId = versionIdByShortId.get(fingertipsId);
    const found = bySlug.get(classificationSlug);
    return indicatorVersionId && found
      ? [{ indicatorVersionId, classificationId: found.id, dimension: found.dimension }]
      : [];
  });
  const versionIds = [...new Set(links.map(({ indicatorVersionId }) => indicatorVersionId))];

  if (versionIds.length > 0) {
    await db
      .delete(indicatorClassification)
      .where(inArray(indicatorClassification.indicatorVersionId, versionIds));
    await db.insert(indicatorClassification).values(
      links.map(({ indicatorVersionId, classificationId }) => ({
        indicatorVersionId,
        classificationId,
      })),
    );
  }

  const answeredYes = (dimension: string) => [
    ...new Set(
      links.filter((link) => link.dimension === dimension).map((link) => link.indicatorVersionId),
    ),
  ];
  const withRiskFactor = answeredYes('risk_factor');
  const withFramework = answeredYes('framework');

  if (withRiskFactor.length > 0) {
    await db
      .update(indicatorVersion)
      .set({ hasRiskFactor: true })
      .where(inArray(indicatorVersion.id, withRiskFactor));
  }
  if (withFramework.length > 0) {
    await db
      .update(indicatorVersion)
      .set({ hasFramework: true })
      .where(inArray(indicatorVersion.id, withFramework));
  }

  return { links: links.length, unknownSlugs: slugs.filter((slug) => !bySlug.has(slug)) };
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
