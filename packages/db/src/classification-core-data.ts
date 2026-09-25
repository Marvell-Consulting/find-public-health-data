import { z } from '@fphd/config';
import { sql } from 'drizzle-orm';

import type { Database } from './client.ts';
import { findDuplicates } from './parse-topics-file.ts';
import {
  type ClassificationRecord,
  classification,
  classificationRecordSchema,
} from './schema/index.ts';
import { summarizeUpsert, type UpsertSummary } from './topic-repository.ts';

const classificationsFileSchema = z.array(classificationRecordSchema);

/**
 * Parses the classifications file, refusing a repeated slug, which the upsert would mishandle,
 * or a name repeated within a dimension, which a publisher could not tell apart.
 */
export function parseClassificationsFile(data: unknown): ClassificationRecord[] {
  const result = classificationsFileSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid classifications file:\n${z.prettifyError(result.error)}`);
  }

  const records = result.data;
  const problems = [
    ...findDuplicates(records.map(({ slug }) => slug)).map((slug) => `duplicate slug: ${slug}`),
    ...findDuplicates(records.map(({ dimension, name }) => `${dimension}: ${name}`)).map(
      (name) => `duplicate name: ${name}`,
    ),
  ];

  if (problems.length > 0) {
    throw new Error(`Invalid classifications file:\n${problems.join('\n')}`);
  }

  return records;
}

export interface ClassificationUpsertResult {
  summary: UpsertSummary;
  /** Rows in the database but not the file: reported, never deleted, as indicators may use them. */
  orphaned: { slug: string; name: string }[];
}

/** Upserts the classifications, matched on slug, rewriting a row only when the file disagrees. */
export async function upsertClassifications(
  db: Database,
  records: ClassificationRecord[],
): Promise<ClassificationUpsertResult> {
  const slugs = new Set(records.map(({ slug }) => slug));
  const existing = await db
    .select({ slug: classification.slug, name: classification.name })
    .from(classification);
  const outcomes = records.length
    ? await db
        .insert(classification)
        .values(records)
        .onConflictDoUpdate({
          target: classification.slug,
          set: {
            dimension: sql`excluded.dimension`,
            name: sql`excluded.name`,
            updatedAt: sql`now()`,
          },
          setWhere: sql`(${classification.dimension}, ${classification.name}) IS DISTINCT FROM (excluded.dimension, excluded.name)`,
        })
        .returning({ id: classification.id, wasInsert: sql<boolean>`xmax = 0` })
    : [];

  return {
    summary: summarizeUpsert(records.length, outcomes),
    orphaned: existing.filter((row) => !slugs.has(row.slug)),
  };
}
