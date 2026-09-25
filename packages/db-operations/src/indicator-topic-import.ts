import { z } from '@fphd/config';
import { type Database, schema } from '@fphd/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const {
  classification,
  currentPublishedVersion,
  indicator,
  indicatorClassification,
  indicatorTopic,
  indicatorVersion,
  topic,
} = schema;

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

export interface IndicatorTopicImportSummary {
  classifications: number;
  classificationLinks: number;
  links: number;
  timestamps: number;
  unknownTopics: string[];
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
 * Replaces the topic memberships of the indicators the file names, and records when the
 * source system last published their data. A membership belongs to a version: the
 * published one if the indicator has one, otherwise its draft. Memberships are replaced,
 * not merged, because the file states what is true now.
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
  const shortIds = [
    ...new Set([
      ...file.indicatorTopics.map(({ fingertipsId }) => fingertipsId),
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
      const indicatorVersionId = versionIdByShortId.get(fingertipsId);
      const classificationId = idBySlug.get(classificationSlug);
      return indicatorVersionId && classificationId
        ? [{ indicatorVersionId, classificationId }]
        : [];
    });
    const classified = [...new Set(rows.map(({ indicatorVersionId }) => indicatorVersionId))];
    if (classified.length > 0) {
      await db
        .delete(indicatorClassification)
        .where(inArray(indicatorClassification.indicatorVersionId, classified));
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
    unknownIndicators: shortIds.filter((id) => !indicatorIdByShortId.has(id)),
  };
}
