import { z } from '@fphd/config';

/**
 * Three files rather than one, because they are three unrelated concerns: which topics an
 * indicator sits under, how it is classified, and when its data was last published. Topics
 * and classifications are referenced by id — a slug is a label that may be rewritten, the id
 * is the row. Indicators are referenced by their Fingertips number, which these exports carry
 * and which resolves against short_id.
 */
export const indicatorTopicFileSchema = z.object({
  indicators: z.array(z.number().int()).default([]),
  areaContextIndicators: z.array(z.number().int()).default([]),
  indicatorTopics: z
    .array(
      z.object({
        topicId: z.uuidv7(),
        fingertipsId: z.number().int(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .default([]),
  indicatorSubtopics: z
    .array(
      z.object({
        topicId: z.uuidv7(),
        subtopicId: z.uuidv7(),
        fingertipsId: z.number().int(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .default([]),
  indicatorDataUpdatedAt: z
    .record(z.string(), z.iso.datetime({ local: true }).nullable())
    .default({}),
  indicatorClassifications: z
    .array(z.object({ fingertipsId: z.number().int(), classificationId: z.uuidv7() }))
    .default([]),
});

export type IndicatorTopicFile = z.infer<typeof indicatorTopicFileSchema>;

export function parseIndicatorTopicFile(data: unknown): IndicatorTopicFile {
  const result = indicatorTopicFileSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid topic indicator file:\n${z.prettifyError(result.error)}`);
  }

  assertValidIndicatorRelationships(result.data);
  return result.data;
}

export function assertValidIndicatorRelationships(file: IndicatorTopicFile): void {
  const topics = new Set<string>();
  const primary = new Set<number>();
  const primaryTopics = new Set<string>();
  const explicitPrimaries = new Set<number>();
  for (const link of file.indicatorTopics) {
    const key = `${link.fingertipsId}:${link.topicId}`;
    if (topics.has(key)) throw new Error(`Duplicate topic placement: ${key}`);
    topics.add(key);
    if (link.isPrimary !== undefined) explicitPrimaries.add(link.fingertipsId);
    if (link.isPrimary) {
      if (primary.has(link.fingertipsId))
        throw new Error(`Multiple primary topics: ${link.fingertipsId}`);
      primary.add(link.fingertipsId);
      primaryTopics.add(key);
    }
  }
  const subtopics = new Set<string>();
  const primarySubtopics = new Set<number>();
  const primaryTopicsWithChildren = new Set<number>();
  for (const link of file.indicatorSubtopics) {
    const parent = `${link.fingertipsId}:${link.topicId}`;
    const key = `${link.fingertipsId}:${link.subtopicId}`;
    if (!topics.has(parent)) throw new Error(`Subtopic has no topic placement: ${parent}`);
    if (subtopics.has(key)) throw new Error(`Duplicate subtopic placement: ${key}`);
    subtopics.add(key);
    if (!primary.has(link.fingertipsId))
      throw new Error(`Missing primary topic: ${link.fingertipsId}`);
    if (primaryTopics.has(parent)) primaryTopicsWithChildren.add(link.fingertipsId);
    if (link.isPrimary) {
      if (!primaryTopics.has(parent) || primarySubtopics.has(link.fingertipsId))
        throw new Error(`Invalid primary subtopic: ${link.fingertipsId}`);
      primarySubtopics.add(link.fingertipsId);
    }
  }
  for (const id of explicitPrimaries)
    if (!primary.has(id)) throw new Error(`Missing primary topic: ${id}`);
  for (const id of primaryTopicsWithChildren)
    if (!primarySubtopics.has(id)) throw new Error(`Missing primary subtopic: ${id}`);
  const linked = new Set(file.indicatorTopics.map(({ fingertipsId }) => fingertipsId));
  const contexts = new Set(file.areaContextIndicators);
  if (contexts.size !== file.areaContextIndicators.length)
    throw new Error('Duplicate area-context indicators');
  for (const id of contexts) {
    if (
      linked.has(id) ||
      file.indicatorClassifications.some(({ fingertipsId }) => fingertipsId === id)
    )
      throw new Error(`Area-context indicator has tags: ${id}`);
  }
}
