import { type Database, schema } from '@fphd/db';
import { CLASSIFICATION_DIMENSIONS } from '@fphd/utils/classification-dimension';
import { eq, getTableColumns } from 'drizzle-orm';

import { hasSqlState } from './indicator-draft-repository.ts';
import {
  ageRangesOf,
  classificationsOf,
  linksOf,
  replaceLists,
  sourcesOf,
  topicIdsOf,
} from './indicator-version-lists-repository.ts';

const { currentPublishedVersion, indicatorVersion } = schema;

export type CreateDraftFromPublishedResult =
  | { ok: true; versionId: string }
  | { ok: false; reason: 'draft_exists' | 'not_published' };

const UNIQUE_VIOLATION = '23505';

/**
 * Opens a draft from the most recently published version: columns, slug and lists alike. The one-draft index refuses a second one rather than this reading first and racing.
 */
export async function createDraftFromPublished(
  db: Database,
  indicatorId: string,
  actor: string,
): Promise<CreateDraftFromPublishedResult> {
  try {
    return await db.transaction(async (tx) => {
      const [published] = await tx
        .select(getTableColumns(indicatorVersion))
        .from(currentPublishedVersion)
        .innerJoin(indicatorVersion, eq(indicatorVersion.id, currentPublishedVersion.id))
        .where(eq(currentPublishedVersion.indicatorId, indicatorId));

      if (published === undefined) return { ok: false, reason: 'not_published' };

      const {
        id: publishedId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        createdBy: _createdBy,
        updatedBy: _updatedBy,
        ...attributes
      } = published;

      const [draft] = await tx
        .insert(indicatorVersion)
        .values({
          ...attributes,
          status: 'draft',
          publishedAt: null,
          // A new version is published when its own publisher says.
          scheduledPublishAt: null,
          createdBy: actor,
          updatedBy: actor,
        })
        .returning({ id: indicatorVersion.id });

      if (draft === undefined) throw new Error('createDraftFromPublished inserted no version');

      const [topicIds, classifications, links, ageRanges, sources] = await Promise.all([
        topicIdsOf(tx, publishedId),
        classificationsOf(tx, publishedId),
        linksOf(tx, publishedId),
        ageRangesOf(tx, publishedId),
        sourcesOf(tx, publishedId),
      ]);

      await replaceLists(tx, draft.id, {
        topicIds,
        classificationIds: Object.fromEntries(
          CLASSIFICATION_DIMENSIONS.map((dimension) => [
            dimension,
            classifications.filter((row) => row.dimension === dimension).map(({ id }) => id),
          ]),
        ),
        links,
        ageRanges,
        ...sources,
      });

      return { ok: true, versionId: draft.id };
    });
  } catch (error) {
    if (hasSqlState(error, UNIQUE_VIOLATION)) return { ok: false, reason: 'draft_exists' };
    throw error;
  }
}
