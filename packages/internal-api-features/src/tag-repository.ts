import { type Database, schema } from '@fphd/db';
import { asc, inArray } from 'drizzle-orm';

import type { TagOptions } from './contract.ts';

const { classification, topic } = schema;

/** Every topic and tagging classification, each list ordered by name as the page shows it. */
export async function listTagOptions(db: Database): Promise<TagOptions> {
  const [topics, classifications] = await Promise.all([
    db.select({ id: topic.id, name: topic.title }).from(topic).orderBy(asc(topic.title)),
    db
      .select({
        id: classification.id,
        name: classification.name,
        dimension: classification.dimension,
      })
      .from(classification)
      .where(inArray(classification.dimension, ['indicator_type', 'risk_factor', 'framework']))
      .orderBy(asc(classification.name)),
  ]);
  const ofDimension = (dimension: string) =>
    classifications
      .filter((row) => row.dimension === dimension)
      .map(({ id, name }) => ({ id, name }));

  return {
    topics,
    indicatorTypes: ofDimension('indicator_type'),
    riskFactors: ofDimension('risk_factor'),
    frameworks: ofDimension('framework'),
  };
}
