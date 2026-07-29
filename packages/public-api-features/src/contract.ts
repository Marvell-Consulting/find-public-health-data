import { z } from '@fphd/config/zod';

/**
 * The wire contract for the public API, defined once and imported by both sides: the
 * routers build responses to these shapes, and the web app's loaders parse against them.
 *
 * This module deliberately imports nothing but zod — it is exposed on its own subpath so a
 * web app can depend on the contract without pulling Express or the database package into
 * its module graph.
 *
 * Timestamps cross the wire as ISO strings (Express serialises Date that way), so the
 * schemas describe what a client actually receives, not the server-side row type.
 */
export const topicSummarySchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const topicSummaryListSchema = z.array(topicSummarySchema);

export const topicDetailSchema = topicSummarySchema.extend({
  description: z.string(),
});

export const indicatorSummarySchema = z.object({
  id: z.uuid(),
  fingertipsId: z.number().int(),
  name: z.string().min(1),
  status: z.string().min(1),
});

export const indicatorListResponseSchema = z.object({
  indicators: z.array(indicatorSummarySchema),
});

export type TopicSummary = z.infer<typeof topicSummarySchema>;
export type TopicDetail = z.infer<typeof topicDetailSchema>;
export type IndicatorSummary = z.infer<typeof indicatorSummarySchema>;
