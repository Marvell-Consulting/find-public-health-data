import { z } from '@fphd/config';

/**
 * Three files rather than one, because they are three unrelated concerns: which topics an
 * indicator sits under, how it is classified, and when its data was last published. Topics
 * and classifications are referenced by id — a slug is a label that may be rewritten, the id
 * is the row. Indicators are referenced by their Fingertips number, which these exports carry
 * and which resolves against short_id.
 */
export const indicatorTopicFileSchema = z.object({
  indicatorTopics: z
    .array(z.object({ topicId: z.uuidv7(), fingertipsId: z.number().int() }))
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

  return result.data;
}
