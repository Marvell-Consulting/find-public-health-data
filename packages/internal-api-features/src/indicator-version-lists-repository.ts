import { type Database, schema } from '@fphd/db';
import {
  CLASSIFICATION_DIMENSIONS,
  type ClassificationDimension,
} from '@fphd/utils/classification-dimension';
import type { IndicatorSourcePart } from '@fphd/utils/source-part';
import { and, asc, eq, inArray } from 'drizzle-orm';

const {
  classification,
  indicatorVersionClassification,
  indicatorVersionTopic,
  indicatorVersionAgeRange,
  indicatorVersionLink,
  indicatorVersionSource,
  topic,
} = schema;

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type IndicatorDraftLink = Pick<typeof indicatorVersionLink.$inferSelect, 'url' | 'text'>;

export type IndicatorDraftAgeRange = Omit<
  typeof indicatorVersionAgeRange.$inferSelect,
  'indicatorVersionId' | 'position'
>;

/** A provider of a numerator's or denominator's data, and its source, null for none specific. */
export type IndicatorDraftSource = Pick<
  typeof indicatorVersionSource.$inferSelect,
  'providerId' | 'sourceId'
>;

/** The providers and sources of each half of the calculation, in the order they were added. */
export interface IndicatorDraftSources {
  numeratorSources: IndicatorDraftSource[];
  denominatorSources: IndicatorDraftSource[];
}

export interface IndicatorDraftClassification {
  id: string;
  dimension: ClassificationDimension;
}

/** The draft's answers held in tables of their own; each is replaced whole when given. */
export interface IndicatorDraftLists extends Partial<IndicatorDraftSources> {
  topicIds?: string[];
  /** Each dimension given is replaced; the others are left as they are. */
  classificationIds?: Partial<Record<ClassificationDimension, string[]>>;
  /** In the order they are shown. */
  links?: IndicatorDraftLink[];
  /** In the order they are shown. */
  ageRanges?: IndicatorDraftAgeRange[];
}

export async function sourcesOf(
  db: Database | Transaction,
  versionId: string,
): Promise<IndicatorDraftSources> {
  const rows = await db
    .select({
      part: indicatorVersionSource.part,
      providerId: indicatorVersionSource.providerId,
      sourceId: indicatorVersionSource.sourceId,
    })
    .from(indicatorVersionSource)
    .where(eq(indicatorVersionSource.indicatorVersionId, versionId))
    .orderBy(asc(indicatorVersionSource.position));
  const ofPart = (part: IndicatorSourcePart) =>
    rows
      .filter((row) => row.part === part)
      .map(({ providerId, sourceId }) => ({ providerId, sourceId }));

  return { numeratorSources: ofPart('numerator'), denominatorSources: ofPart('denominator') };
}

export async function linksOf(
  db: Database | Transaction,
  versionId: string,
): Promise<IndicatorDraftLink[]> {
  return db
    .select({ url: indicatorVersionLink.url, text: indicatorVersionLink.text })
    .from(indicatorVersionLink)
    .where(eq(indicatorVersionLink.indicatorVersionId, versionId))
    .orderBy(asc(indicatorVersionLink.position));
}

export async function topicIdsOf(db: Database | Transaction, versionId: string): Promise<string[]> {
  const rows = await db
    .select({ id: indicatorVersionTopic.topicId })
    .from(indicatorVersionTopic)
    .innerJoin(topic, eq(topic.id, indicatorVersionTopic.topicId))
    .where(eq(indicatorVersionTopic.indicatorVersionId, versionId))
    .orderBy(asc(topic.title));

  return rows.map(({ id }) => id);
}

export async function classificationsOf(
  db: Database | Transaction,
  versionId: string,
): Promise<IndicatorDraftClassification[]> {
  return db
    .select({ id: classification.id, dimension: classification.dimension })
    .from(indicatorVersionClassification)
    .innerJoin(
      classification,
      eq(classification.id, indicatorVersionClassification.classificationId),
    )
    .where(eq(indicatorVersionClassification.indicatorVersionId, versionId))
    .orderBy(asc(classification.name));
}

export async function ageRangesOf(
  db: Database | Transaction,
  versionId: string,
): Promise<IndicatorDraftAgeRange[]> {
  return db
    .select({
      lowerLimit: indicatorVersionAgeRange.lowerLimit,
      lowerLimitUnit: indicatorVersionAgeRange.lowerLimitUnit,
      upperLimit: indicatorVersionAgeRange.upperLimit,
      upperLimitUnit: indicatorVersionAgeRange.upperLimitUnit,
    })
    .from(indicatorVersionAgeRange)
    .where(eq(indicatorVersionAgeRange.indicatorVersionId, versionId))
    .orderBy(asc(indicatorVersionAgeRange.position));
}

export async function replaceLists(
  tx: Transaction,
  versionId: string,
  {
    ageRanges,
    classificationIds,
    links,
    topicIds,
    numeratorSources,
    denominatorSources,
  }: IndicatorDraftLists,
): Promise<void> {
  if (topicIds !== undefined) {
    await tx
      .delete(indicatorVersionTopic)
      .where(eq(indicatorVersionTopic.indicatorVersionId, versionId));
    if (topicIds.length > 0) {
      await tx
        .insert(indicatorVersionTopic)
        .values(topicIds.map((topicId) => ({ topicId, indicatorVersionId: versionId })));
    }
  }

  for (const dimension of CLASSIFICATION_DIMENSIONS) {
    const ids = classificationIds?.[dimension];
    if (ids === undefined) continue;

    await tx
      .delete(indicatorVersionClassification)
      .where(
        and(
          eq(indicatorVersionClassification.indicatorVersionId, versionId),
          inArray(
            indicatorVersionClassification.classificationId,
            tx
              .select({ id: classification.id })
              .from(classification)
              .where(eq(classification.dimension, dimension)),
          ),
        ),
      );
    if (ids.length > 0) {
      await tx
        .insert(indicatorVersionClassification)
        .values(
          ids.map((classificationId) => ({ classificationId, indicatorVersionId: versionId })),
        );
    }
  }

  if (links !== undefined) {
    await tx
      .delete(indicatorVersionLink)
      .where(eq(indicatorVersionLink.indicatorVersionId, versionId));
    if (links.length > 0) {
      await tx.insert(indicatorVersionLink).values(
        links.map(({ url, text }, position) => ({
          indicatorVersionId: versionId,
          position,
          url,
          text,
        })),
      );
    }
  }

  if (ageRanges !== undefined) {
    await tx
      .delete(indicatorVersionAgeRange)
      .where(eq(indicatorVersionAgeRange.indicatorVersionId, versionId));
    if (ageRanges.length > 0) {
      await tx.insert(indicatorVersionAgeRange).values(
        ageRanges.map((range, position) => ({
          ...range,
          indicatorVersionId: versionId,
          position,
        })),
      );
    }
  }

  await replaceSources(tx, versionId, 'numerator', numeratorSources);
  await replaceSources(tx, versionId, 'denominator', denominatorSources);
}

async function replaceSources(
  tx: Transaction,
  versionId: string,
  part: IndicatorSourcePart,
  sources: IndicatorDraftSource[] | undefined,
): Promise<void> {
  if (sources === undefined) return;

  await tx
    .delete(indicatorVersionSource)
    .where(
      and(
        eq(indicatorVersionSource.indicatorVersionId, versionId),
        eq(indicatorVersionSource.part, part),
      ),
    );

  if (sources.length > 0) {
    await tx.insert(indicatorVersionSource).values(
      sources.map(({ providerId, sourceId }, position) => ({
        indicatorVersionId: versionId,
        part,
        position,
        providerId,
        sourceId,
      })),
    );
  }
}
