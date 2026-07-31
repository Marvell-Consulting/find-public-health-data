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

export const indicatorSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().nullable(),
});

export const indicatorDetailSchema = z.object({
  fingertipsId: z.number().int(),
  name: z.string().min(1),
  valueType: z.string().min(1),
  unit: z.object({ name: z.string().min(1), label: z.string().min(1) }),
  yearType: z.string().min(1),
  frequency: z.string().min(1),
  polarity: z.string().min(1),
  ciMethod: z.string().nullable(),
  ciConfidenceLevel: z.string().nullable(),
  comparatorMethod: z.string().nullable(),
  dataUpdatedAt: z.iso.datetime().nullable(),
  definition: z.string().nullable(),
  rationale: z.string().nullable(),
  methodology: z.string().nullable(),
  numeratorDefinition: z.string().nullable(),
  denominatorDefinition: z.string().nullable(),
  disclosureControl: z.string().nullable(),
  caveats: z.string().nullable(),
  notes: z.string().nullable(),
  dataSource: indicatorSourceSchema.nullable(),
  numeratorSource: indicatorSourceSchema.nullable(),
  denominatorSource: indicatorSourceSchema.nullable(),
  areaTypes: z.array(z.object({ name: z.string().min(1), areaCount: z.number().int() })),
  topics: z.array(z.object({ slug: z.string().min(1), title: z.string().min(1) })),
});

export const indicatorObservationSchema = z.object({
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  value: z.number().nullable(),
  lowerCi95: z.number().nullable(),
  upperCi95: z.number().nullable(),
  count: z.number().nullable(),
  denominator: z.number().nullable(),
  dimensions: z.array(
    z.object({
      type: z.string().min(1),
      value: z.string().min(1),
      dimensionClass: z.string().min(1),
      sortOrder: z.number().int(),
    }),
  ),
});

export const indicatorAreaDataSchema = z.object({
  areaCode: z.string().min(1),
  areaName: z.string().min(1),
  observations: z.array(indicatorObservationSchema),
});

export const areaSummarySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

export const areaListSchema = z.array(areaSummarySchema);

export const areaGroupListSchema = z.array(
  z.object({ areaType: z.string().min(1), areas: areaListSchema }),
);

export type TopicSummary = z.infer<typeof topicSummarySchema>;
export type TopicDetail = z.infer<typeof topicDetailSchema>;
export type IndicatorSummary = z.infer<typeof indicatorSummarySchema>;
export type IndicatorDetail = z.infer<typeof indicatorDetailSchema>;
export type IndicatorSource = z.infer<typeof indicatorSourceSchema>;
export type IndicatorObservation = z.infer<typeof indicatorObservationSchema>;
export type IndicatorAreaData = z.infer<typeof indicatorAreaDataSchema>;
export type AreaSummary = z.infer<typeof areaSummarySchema>;
export type AreaGroup = z.infer<typeof areaGroupListSchema>[number];
