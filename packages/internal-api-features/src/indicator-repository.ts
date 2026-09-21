import { type Database, schema } from '@fphd/db';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { IndicatorStatus } from './contract.ts';

const { indicator, indicatorClassification, indicatorTopic, indicatorVersion } = schema;

export interface IndicatorAdminRow {
  id: string;
  name: string;
  updatedAt: Date;
}

export interface IndicatorAdminRows {
  indicators: IndicatorAdminRow[];
  total: number;
}

export interface IndicatorAdminDetailRow extends IndicatorAdminRow {
  shortId: number;
  status: IndicatorStatus;
}

/**
 * The partial unique indexes make these joins one row each, so an indicator's draft and
 * published versions can be read side by side rather than through a lateral subquery.
 */
const draftVersion = alias(indicatorVersion, 'draft_version');
const publishedVersion = alias(indicatorVersion, 'published_version');

const draftJoin = and(eq(draftVersion.indicatorId, indicator.id), eq(draftVersion.status, 'draft'));
const publishedJoin = and(
  eq(publishedVersion.indicatorId, indicator.id),
  eq(publishedVersion.status, 'published'),
);

// The draft is what a publisher is working on, so it names the indicator while it exists.
const currentName = sql<string>`coalesce(${draftVersion.name}, ${publishedVersion.name})`;
// greatest() ignores nulls, so an indicator with only one version still reports its date.
// mapWith, because a bare sql fragment arrives as the driver's string, not a Date.
const latestUpdatedAt =
  sql`greatest(${draftVersion.updatedAt}, ${publishedVersion.updatedAt})`.mapWith(
    indicatorVersion.updatedAt,
  );
const derivedStatus = sql<IndicatorStatus>`case when ${draftVersion.id} is not null then 'draft' else 'published' end`;

/** Every indicator whatever its status, newest edit first; the id breaks any remaining tie. */
export async function listIndicatorsPage(
  db: Database,
  page: number,
  pageSize: number,
): Promise<IndicatorAdminRows> {
  const [indicators, [counted]] = await Promise.all([
    db
      .select({ id: indicator.id, name: currentName, updatedAt: latestUpdatedAt })
      .from(indicator)
      .leftJoin(draftVersion, draftJoin)
      .leftJoin(publishedVersion, publishedJoin)
      .orderBy(desc(latestUpdatedAt), asc(currentName), asc(indicator.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(indicator),
  ]);

  return { indicators, total: counted?.total ?? 0 };
}

/** One indicator by its row id, whatever its status. */
export async function getIndicatorById(
  db: Database,
  id: string,
): Promise<IndicatorAdminDetailRow | undefined> {
  const rows = await db
    .select({
      id: indicator.id,
      shortId: indicator.shortId,
      name: currentName,
      status: derivedStatus,
      updatedAt: latestUpdatedAt,
    })
    .from(indicator)
    .leftJoin(draftVersion, draftJoin)
    .leftJoin(publishedVersion, publishedJoin)
    .where(eq(indicator.id, id));

  return rows[0];
}

/** The version columns a publisher edits: not the identity, the status or the audit trail. */
type EditableVersionColumns = Omit<
  typeof indicatorVersion.$inferInsert,
  | 'createdAt'
  | 'createdBy'
  | 'id'
  | 'indicatorId'
  | 'publishedAt'
  | 'status'
  | 'updatedAt'
  | 'updatedBy'
>;

/** An update rewrites the columns it names, so every one of them is optional. */
export type IndicatorDraftAttributes = Partial<EditableVersionColumns>;

/** A new draft comes from the page that asks for a name, so it always has one. */
export type NewIndicatorDraftAttributes = IndicatorDraftAttributes &
  Pick<EditableVersionColumns, 'name'>;

export interface IndicatorDraftMemberships {
  topicIds?: string[];
  classificationIds?: string[];
}

export interface CreatedIndicatorDraft {
  indicatorId: string;
  shortId: number;
  versionId: string;
}

export type UpdateIndicatorDraftResult = { ok: true } | { ok: false; reason: 'no_draft' };

export type CreateDraftFromPublishedResult =
  | { ok: true; versionId: string }
  | { ok: false; reason: 'draft_exists' | 'not_published' };

const UNIQUE_VIOLATION = '23505';

/** Drizzle wraps the driver error, so the SQLSTATE is on a `cause` rather than the error thrown. */
function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current !== null && current !== undefined; ) {
    if (typeof current !== 'object') return false;
    if ('code' in current && (current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/** A new indicator is an identity and a draft version; the database mints both ids. */
export async function createIndicatorDraft(
  db: Database,
  attributes: NewIndicatorDraftAttributes,
  actor: string,
): Promise<CreatedIndicatorDraft> {
  return db.transaction(async (tx) => {
    const [identity] = await tx
      .insert(indicator)
      .values({})
      .returning({ id: indicator.id, shortId: indicator.shortId });

    if (identity === undefined) throw new Error('createIndicatorDraft inserted no indicator');

    const [version] = await tx
      .insert(indicatorVersion)
      .values({
        ...attributes,
        indicatorId: identity.id,
        status: 'draft',
        createdBy: actor,
        updatedBy: actor,
      })
      .returning({ id: indicatorVersion.id });

    if (version === undefined) throw new Error('createIndicatorDraft inserted no version');

    return { indicatorId: identity.id, shortId: identity.shortId, versionId: version.id };
  });
}

/**
 * Rewrites a draft's columns and, when given, its memberships. Memberships are replaced
 * rather than merged: the submission states what is true now.
 */
export async function updateIndicatorDraft(
  db: Database,
  indicatorId: string,
  attributes: IndicatorDraftAttributes,
  memberships: IndicatorDraftMemberships,
  actor: string,
): Promise<UpdateIndicatorDraftResult> {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .update(indicatorVersion)
      .set({ ...attributes, updatedAt: sql`now()`, updatedBy: actor })
      .where(
        and(eq(indicatorVersion.indicatorId, indicatorId), eq(indicatorVersion.status, 'draft')),
      )
      .returning({ id: indicatorVersion.id });

    if (draft === undefined) return { ok: false, reason: 'no_draft' };

    await replaceMemberships(tx, draft.id, memberships);

    return { ok: true };
  });
}

/**
 * Opens a draft from what is published, columns and memberships alike. The one-draft index
 * refuses a second one rather than this reading first and racing.
 */
export async function createDraftFromPublished(
  db: Database,
  indicatorId: string,
  actor: string,
): Promise<CreateDraftFromPublishedResult> {
  try {
    return await db.transaction(async (tx) => {
      const [published] = await tx
        .select()
        .from(indicatorVersion)
        .where(
          and(
            eq(indicatorVersion.indicatorId, indicatorId),
            eq(indicatorVersion.status, 'published'),
          ),
        );

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
          createdBy: actor,
          updatedBy: actor,
        })
        .returning({ id: indicatorVersion.id });

      if (draft === undefined) throw new Error('createDraftFromPublished inserted no version');

      const [topics, classifications] = await Promise.all([
        tx
          .select({ topicId: indicatorTopic.topicId })
          .from(indicatorTopic)
          .where(eq(indicatorTopic.indicatorVersionId, publishedId)),
        tx
          .select({ classificationId: indicatorClassification.classificationId })
          .from(indicatorClassification)
          .where(eq(indicatorClassification.indicatorVersionId, publishedId)),
      ]);

      await replaceMemberships(tx, draft.id, {
        topicIds: topics.map(({ topicId }) => topicId),
        classificationIds: classifications.map(({ classificationId }) => classificationId),
      });

      return { ok: true, versionId: draft.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'draft_exists' };
    throw error;
  }
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

async function replaceMemberships(
  tx: Transaction,
  versionId: string,
  { classificationIds, topicIds }: IndicatorDraftMemberships,
): Promise<void> {
  if (topicIds !== undefined) {
    await tx.delete(indicatorTopic).where(eq(indicatorTopic.indicatorVersionId, versionId));
    if (topicIds.length > 0) {
      await tx
        .insert(indicatorTopic)
        .values(topicIds.map((topicId) => ({ topicId, indicatorVersionId: versionId })));
    }
  }

  if (classificationIds !== undefined) {
    await tx
      .delete(indicatorClassification)
      .where(eq(indicatorClassification.indicatorVersionId, versionId));
    if (classificationIds.length > 0) {
      await tx.insert(indicatorClassification).values(
        classificationIds.map((classificationId) => ({
          classificationId,
          indicatorVersionId: versionId,
        })),
      );
    }
  }
}
