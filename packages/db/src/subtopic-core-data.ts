import { z } from '@fphd/config';
import { sql } from 'drizzle-orm';

import { recordAudit } from './audit-log.ts';
import type { Database } from './client.ts';
import { CORE_DATA_IMPORT, upsertEntries, upsertedRow } from './core-data-audit.ts';
import { findDuplicates } from './parse-topics-file.ts';
import { type SubtopicRecord, subtopic, subtopicRecordSchema } from './schema/index.ts';
import { summarizeUpsert, type UpsertSummary } from './topic-repository.ts';

export function parseSubtopicsFile(data: unknown): SubtopicRecord[] {
  const result = z.array(subtopicRecordSchema).safeParse(data);
  if (!result.success) throw new Error(`Invalid subtopics file:\n${z.prettifyError(result.error)}`);
  const duplicates = [
    ...findDuplicates(result.data.map(({ id }) => id)),
    ...findDuplicates(result.data.map(({ topicId, slug }) => `${topicId}:${slug}`)),
  ];
  if (duplicates.length) throw new Error(`Duplicate subtopics: ${duplicates.join(', ')}`);
  return result.data;
}

export async function upsertSubtopics(
  db: Database,
  records: SubtopicRecord[],
): Promise<UpsertSummary> {
  return db.transaction(async (tx) => {
    const outcomes =
      records.length === 0
        ? []
        : await tx
            .insert(subtopic)
            .values(records)
            .onConflictDoUpdate({
              target: subtopic.id,
              set: {
                topicId: sql`excluded.topic_id`,
                slug: sql`excluded.slug`,
                title: sql`excluded.title`,
                updatedAt: sql`now()`,
              },
              setWhere: sql`(${subtopic.topicId}, ${subtopic.slug}, ${subtopic.title}) IS DISTINCT FROM (excluded.topic_id, excluded.slug, excluded.title)`,
            })
            .returning({ id: subtopic.id, wasInsert: sql<boolean>`xmax = 0`, ...upsertedRow });
    await recordAudit(tx, CORE_DATA_IMPORT, upsertEntries(subtopic, outcomes));
    return summarizeUpsert(records.length, outcomes);
  });
}
