import { type Database, schema } from '@fphd/db';
import {
  type ClassificationDimension,
  TAGGING_DIMENSIONS,
} from '@fphd/utils/classification-dimension';
import { and, asc, eq, inArray } from 'drizzle-orm';

import type { TagOptions } from './contract.ts';

const { classification, topic } = schema;

/** Every topic and tagging classification, each list ordered by name as the page shows it. */
export async function listTagOptions(db: Database): Promise<TagOptions> {
  const [topics, classifications] = await Promise.all([
    db
      .select({ id: topic.id, name: topic.title })
      .from(topic)
      .where(eq(topic.isActive, true))
      .orderBy(asc(topic.title)),
    db
      .select({
        id: classification.id,
        name: classification.name,
        dimension: classification.dimension,
      })
      .from(classification)
      .where(
        and(
          eq(classification.isActive, true),
          inArray(classification.dimension, [...TAGGING_DIMENSIONS]),
        ),
      )
      .orderBy(asc(classification.name)),
  ]);
  const ofDimension = (dimension: ClassificationDimension) =>
    classifications
      .filter((row) => row.dimension === dimension)
      .map(({ id, name }) => ({ id, name }));

  return {
    topics,
    indicatorTypes: ofDimension('indicator_type'),
    lifeStages: ofDimension('life_stage'),
    frameworks: ofDimension('framework'),
  };
}
