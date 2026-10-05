import { z } from '@fphd/config';

import { indicatorTopicFileSchema } from './indicator-topic-repository.ts';

export const dataMigrationRelationshipsSchema = indicatorTopicFileSchema.extend({
  approval: z.object({
    approvedBy: z.string().min(1),
    approvedAt: z.iso.datetime({ offset: true }),
    basis: z.string().min(1),
  }),
  indicators: z.array(z.number().int().positive()),
});

export type DataMigrationRelationships = z.infer<typeof dataMigrationRelationshipsSchema>;

export function parseDataMigrationRelationships(value: unknown): DataMigrationRelationships {
  const result = dataMigrationRelationshipsSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid data migration relationships:\n${z.prettifyError(result.error)}`);
  }
  if (new Set(result.data.indicators).size !== result.data.indicators.length) {
    throw new Error('Data migration relationship coverage contains duplicate indicators');
  }
  return result.data;
}
