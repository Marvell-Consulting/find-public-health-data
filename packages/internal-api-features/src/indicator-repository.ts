import { type Database, schema } from '@fphd/db';
import { slugify, slugProblem } from '@fphd/utils/slug';
import { and, asc, count, desc, eq, getTableColumns, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { CiMethodKind, DraftStatus, IndicatorStatus } from './contract.ts';

const {
  ciMethod,
  currentPublishedVersion,
  indicator,
  indicatorClassification,
  indicatorTopic,
  indicatorVersion,
  indicatorVersionLink,
  indicatorVersionSource,
} = schema;

export interface IndicatorAdminRow {
  id: string;
  name: string;
  updatedAt: Date;
  indicatorStatus: IndicatorStatus;
  draftStatus: DraftStatus | null;
}

export interface IndicatorAdminRows {
  indicators: IndicatorAdminRow[];
  total: number;
}

export interface IndicatorAdminDetailRow extends IndicatorAdminRow {
  shortId: number;
  /** The published version's slug, and so its public address; null while none is published. */
  publishedSlug: string | null;
}

/**
 * The one-draft index makes the draft join one row, and currentPublishedVersion is one row
 * per indicator, so an indicator's draft and published versions can be read side by side.
 * The view names the published version; its columns come from the version table by id.
 */
const draftVersion = alias(indicatorVersion, 'draft_version');
const publishedVersion = alias(indicatorVersion, 'published_version');

const draftJoin = and(eq(draftVersion.indicatorId, indicator.id), eq(draftVersion.status, 'draft'));
const publishedJoin = eq(currentPublishedVersion.indicatorId, indicator.id);
const publishedVersionJoin = eq(publishedVersion.id, currentPublishedVersion.id);

// The draft is what a publisher is working on, so it names the indicator while it exists.
const currentName = sql<string>`coalesce(${draftVersion.name}, ${publishedVersion.name})`;
// greatest() ignores nulls, so an indicator with only one version still reports its date.
// mapWith, because a bare sql fragment arrives as the driver's string, not a Date.
const latestUpdatedAt =
  sql`greatest(${draftVersion.updatedAt}, ${publishedVersion.updatedAt})`.mapWith(
    indicatorVersion.updatedAt,
  );
// Both statuses are read from the versions as SQL, so a filter or sort on either is a WHERE clause.
const indicatorStatus = sql<IndicatorStatus>`case when ${currentPublishedVersion.id} is not null then 'live' else 'new' end`;
// The draft join fixes the status it matches, which narrows the column from the version enum.
const draftStatus = sql<DraftStatus | null>`${draftVersion.status}`;

/** Every indicator whatever its status, newest edit first; the id breaks any remaining tie. */
export async function listIndicatorsPage(
  db: Database,
  page: number,
  pageSize: number,
): Promise<IndicatorAdminRows> {
  const [indicators, [counted]] = await Promise.all([
    db
      .select({
        id: indicator.id,
        name: currentName,
        updatedAt: latestUpdatedAt,
        indicatorStatus,
        draftStatus,
      })
      .from(indicator)
      .leftJoin(draftVersion, draftJoin)
      .leftJoin(currentPublishedVersion, publishedJoin)
      .leftJoin(publishedVersion, publishedVersionJoin)
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
      publishedSlug: publishedVersion.slug,
      updatedAt: latestUpdatedAt,
      indicatorStatus,
      draftStatus,
    })
    .from(indicator)
    .leftJoin(draftVersion, draftJoin)
    .leftJoin(currentPublishedVersion, publishedJoin)
    .leftJoin(publishedVersion, publishedVersionJoin)
    .where(eq(indicator.id, id));

  return rows[0];
}

/** Every column of one version, as a section reads its answers from the draft. */
export type IndicatorDraftVersion = typeof indicatorVersion.$inferSelect;

export type IndicatorDraftLink = Pick<typeof indicatorVersionLink.$inferSelect, 'url' | 'text'>;

/** A provider of a numerator's or denominator's data, and its source, null for none specific. */
export type IndicatorDraftSource = Pick<
  typeof indicatorVersionSource.$inferSelect,
  'providerId' | 'sourceId'
>;

/** The providers and sources of each half of the calculation, in the order they were added. */
export interface IndicatorDraftSources {
  numeratorSources: IndicatorDraftSource[];
  denominatorSources: IndicatorDraftSource[];
}

/**
 * A draft as the sections read it: its columns, its scheduled publication in UK time, and the
 * lists held in tables of their own.
 */
export type IndicatorDraft = IndicatorDraftVersion &
  IndicatorDraftSources & {
    /** `scheduledPublishAt` as ISO 8601 with the UK offset then in force, such as `+01:00`. */
    scheduledPublishAtUk: string | null;
    links: IndicatorDraftLink[];
  };

/** A date and time as a publisher in the UK gives it, whether GMT or BST is in force. */
export interface UkDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

// Publishers give and read times in UK local time; the database resolves its clock changes.
const UK_TIME_ZONE = 'Europe/London';

/** An instant as ISO 8601 in UK local time, with its offset: never negative in the UK. */
function inUkTime(instant: SQL): SQL<string | null> {
  const local = sql`(${instant} AT TIME ZONE ${UK_TIME_ZONE})`;
  return sql<
    string | null
  >`to_char(${local}, 'YYYY-MM-DD"T"HH24:MI:SS') || to_char(${local} - (${instant} AT TIME ZONE 'UTC'), '"+"HH24:MI')`;
}

/**
 * The instant a UK date and time names, as ISO 8601 with its UK offset, or null for a time
 * the spring clock change skips. A time the autumn change repeats is its second, GMT,
 * occurrence, which is what make_timestamptz gives.
 */
export async function ukInstant(
  db: Database,
  { year, month, day, hour, minute }: UkDateTime,
): Promise<string | null> {
  const [row] = await db.execute<{ instant: string | null }>(sql`
    SELECT CASE WHEN (t.instant AT TIME ZONE ${UK_TIME_ZONE}) = t.local
      THEN ${inUkTime(sql`t.instant`)} END AS instant
    FROM (
      SELECT
        make_timestamptz(${year}::int, ${month}::int, ${day}::int, ${hour}::int, ${minute}::int, 0, ${UK_TIME_ZONE}) AS instant,
        make_timestamp(${year}::int, ${month}::int, ${day}::int, ${hour}::int, ${minute}::int, 0) AS local
    ) AS t
  `);

  if (row === undefined) throw new Error('ukInstant returned no row');

  // A skipped time is moved an hour on, so it reads back as a different local time.
  return row.instant;
}

export interface IndicatorDraftStateRow {
  id: string;
  shortId: number;
  /** The draft a publisher is working on, absent while the indicator has none. */
  draft: IndicatorDraft | null;
  /** What the draft's CI method asks for, which the task list needs to judge its answers. */
  draftCiMethodKind: CiMethodKind | null;
  indicatorStatus: IndicatorStatus;
  draftStatus: DraftStatus | null;
}

/** The draft and the indicator's two statuses, which is what a task list is derived from. */
export async function getIndicatorDraftState(
  db: Database,
  id: string,
): Promise<IndicatorDraftStateRow | undefined> {
  const [row] = await db
    .select({
      id: indicator.id,
      shortId: indicator.shortId,
      draft: draftVersion,
      draftScheduledPublishAtUk: inUkTime(sql`${draftVersion.scheduledPublishAt}`),
      draftCiMethodKind: ciMethod.kind,
      indicatorStatus,
      draftStatus,
    })
    .from(indicator)
    .leftJoin(draftVersion, draftJoin)
    .leftJoin(ciMethod, eq(ciMethod.id, draftVersion.ciMethodId))
    .leftJoin(currentPublishedVersion, publishedJoin)
    .where(eq(indicator.id, id));

  if (row === undefined) return undefined;

  const { draft, draftScheduledPublishAtUk: scheduledPublishAtUk, ...state } = row;

  return {
    ...state,
    draft: draft && {
      ...draft,
      ...(await sourcesOf(db, draft.id)),
      scheduledPublishAtUk,
      links: await linksOf(db, draft.id),
    },
  };
}

async function sourcesOf(
  db: Database | Transaction,
  versionId: string,
): Promise<IndicatorDraftSources> {
  const rows = await db
    .select({
      part: indicatorVersionSource.part,
      providerId: indicatorVersionSource.providerId,
      sourceId: indicatorVersionSource.sourceId,
    })
    .from(indicatorVersionSource)
    .where(eq(indicatorVersionSource.indicatorVersionId, versionId))
    .orderBy(asc(indicatorVersionSource.position));
  const ofPart = (part: schema.IndicatorSourcePart) =>
    rows
      .filter((row) => row.part === part)
      .map(({ providerId, sourceId }) => ({ providerId, sourceId }));

  return { numeratorSources: ofPart('numerator'), denominatorSources: ofPart('denominator') };
}

async function linksOf(
  db: Database | Transaction,
  versionId: string,
): Promise<IndicatorDraftLink[]> {
  return db
    .select({ url: indicatorVersionLink.url, text: indicatorVersionLink.text })
    .from(indicatorVersionLink)
    .where(eq(indicatorVersionLink.indicatorVersionId, versionId))
    .orderBy(asc(indicatorVersionLink.position));
}

/**
 * The version columns a publisher edits: not the identity, the status or the audit trail,
 * and not the slug, which is derived from the name until the indicator is first published
 * and then stays as the public address.
 */
type EditableVersionColumns = Omit<
  typeof indicatorVersion.$inferInsert,
  | 'createdAt'
  | 'createdBy'
  | 'id'
  | 'indicatorId'
  | 'publishedAt'
  | 'slug'
  | 'status'
  | 'updatedAt'
  | 'updatedBy'
>;

/** An update rewrites the columns it names, so every one of them is optional. */
export type IndicatorDraftAttributes = Partial<EditableVersionColumns>;

/** A new draft comes from the page that asks for a name, so it always has one. */
export type NewIndicatorDraftAttributes = IndicatorDraftAttributes &
  Pick<EditableVersionColumns, 'name'>;

/** The draft's answers held in tables of their own; each is replaced whole when given. */
export interface IndicatorDraftLists extends Partial<IndicatorDraftSources> {
  topicIds?: string[];
  classificationIds?: string[];
  /** In the order they are shown. */
  links?: IndicatorDraftLink[];
}

export interface CreatedIndicatorDraft {
  indicatorId: string;
  shortId: number;
  versionId: string;
}

export type CreateIndicatorDraftResult =
  | ({ ok: true } & CreatedIndicatorDraft)
  | { ok: false; reason: 'slug_taken' };

export type UpdateIndicatorDraftResult =
  | { ok: true }
  | { ok: false; reason: 'no_draft' | 'slug_taken' };

export type CreateDraftFromPublishedResult =
  | { ok: true; versionId: string }
  | { ok: false; reason: 'draft_exists' | 'not_published' };

const UNIQUE_VIOLATION = '23505';
// The slug exclusion constraint: another indicator already holds the slug this name yields.
const EXCLUSION_VIOLATION = '23P01';
// Scopes the slug locks within the two-key advisory lock space; no other lock uses this first key.
export const SLUG_LOCK_NAMESPACE = 0x736c7567; // 'slug'

/** Drizzle wraps the driver error, so the SQLSTATE is on a `cause` rather than the error thrown. */
function hasSqlState(error: unknown, sqlState: string): boolean {
  for (let current = error; current !== null && current !== undefined; ) {
    if (typeof current !== 'object') return false;
    if ('code' in current && (current as { code?: unknown }).code === sqlState) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * The slug a draft takes. The name page refuses a name that yields none, so reaching this
 * with one is a bug rather than a submission to report.
 */
function draftSlug(name: string): string {
  const problem = slugProblem(name);

  if (problem !== undefined) {
    throw new Error(`Indicator name yields no usable slug (${problem}): ${name}`);
  }

  return slugify(name);
}

/** A new indicator is an identity and a draft version; the database mints both ids. */
export async function createIndicatorDraft(
  db: Database,
  attributes: NewIndicatorDraftAttributes,
  actor: string,
): Promise<CreateIndicatorDraftResult> {
  const slug = draftSlug(attributes.name);

  try {
    return await db.transaction(async (tx) => {
      await lockSlugs(tx, [slug]);

      const [identity] = await tx
        .insert(indicator)
        .values({})
        .returning({ id: indicator.id, shortId: indicator.shortId });

      if (identity === undefined) throw new Error('createIndicatorDraft inserted no indicator');

      const [version] = await tx
        .insert(indicatorVersion)
        .values({
          ...attributes,
          slug,
          indicatorId: identity.id,
          status: 'draft',
          createdBy: actor,
          updatedBy: actor,
        })
        .returning({ id: indicatorVersion.id });

      if (version === undefined) throw new Error('createIndicatorDraft inserted no version');

      return {
        ok: true,
        indicatorId: identity.id,
        shortId: identity.shortId,
        versionId: version.id,
      };
    });
  } catch (error) {
    if (hasSqlState(error, EXCLUSION_VIOLATION)) return { ok: false, reason: 'slug_taken' };
    throw error;
  }
}

/**
 * Rewrites a draft's columns and, when given, its lists. Lists are replaced rather than
 * merged: the submission states what is true now. A renamed draft is
 * re-slugged only while nothing is published: once an indicator has a public address,
 * every version keeps it, so a rename never moves the page.
 */
export async function updateIndicatorDraft(
  db: Database,
  indicatorId: string,
  attributes: IndicatorDraftAttributes,
  lists: IndicatorDraftLists,
  actor: string,
): Promise<UpdateIndicatorDraftResult> {
  try {
    return await db.transaction(async (tx) => {
      // The name is checked whether or not the slug it yields is used.
      const slug = attributes.name === undefined ? undefined : draftSlug(attributes.name);
      const renamed = slug === undefined || (await isPublished(tx, indicatorId)) ? {} : { slug };

      // The slug left behind is held too, or two renames swapping slugs deadlock.
      if ('slug' in renamed)
        await lockSlugs(tx, [await draftSlugOf(tx, indicatorId), renamed.slug]);

      const [draft] = await tx
        .update(indicatorVersion)
        .set({ ...attributes, ...renamed, updatedAt: sql`now()`, updatedBy: actor })
        .where(
          and(eq(indicatorVersion.indicatorId, indicatorId), eq(indicatorVersion.status, 'draft')),
        )
        .returning({ id: indicatorVersion.id });

      if (draft === undefined) return { ok: false, reason: 'no_draft' };

      await replaceLists(tx, draft.id, lists);

      return { ok: true };
    });
  } catch (error) {
    if (hasSqlState(error, EXCLUSION_VIOLATION)) return { ok: false, reason: 'slug_taken' };
    throw error;
  }
}

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

      const [topics, classifications, links, sources] = await Promise.all([
        tx
          .select({ topicId: indicatorTopic.topicId })
          .from(indicatorTopic)
          .where(eq(indicatorTopic.indicatorVersionId, publishedId)),
        tx
          .select({ classificationId: indicatorClassification.classificationId })
          .from(indicatorClassification)
          .where(eq(indicatorClassification.indicatorVersionId, publishedId)),
        linksOf(tx, publishedId),
        sourcesOf(tx, publishedId),
      ]);

      await replaceLists(tx, draft.id, {
        topicIds: topics.map(({ topicId }) => topicId),
        classificationIds: classifications.map(({ classificationId }) => classificationId),
        links,
        ...sources,
      });

      return { ok: true, versionId: draft.id };
    });
  } catch (error) {
    if (hasSqlState(error, UNIQUE_VIOLATION)) return { ok: false, reason: 'draft_exists' };
    throw error;
  }
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Holds slugs until the transaction ends. Two writers of one slug otherwise each wait on the
 * other's exclusion check and deadlock; serialised, the later one fails the constraint instead.
 * Taken in one order, so two writers wanting the same pair cannot deadlock on the locks.
 */
async function lockSlugs(tx: Transaction, slugs: readonly (string | undefined)[]): Promise<void> {
  const held = [...new Set(slugs)].filter((slug) => slug !== undefined).sort();

  for (const slug of held) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SLUG_LOCK_NAMESPACE}, hashtext(${slug}))`);
  }
}

async function draftSlugOf(tx: Transaction, indicatorId: string): Promise<string | undefined> {
  const [draft] = await tx
    .select({ slug: indicatorVersion.slug })
    .from(indicatorVersion)
    .where(
      and(eq(indicatorVersion.indicatorId, indicatorId), eq(indicatorVersion.status, 'draft')),
    );

  return draft?.slug;
}

async function isPublished(tx: Transaction, indicatorId: string): Promise<boolean> {
  const [published] = await tx
    .select({ id: currentPublishedVersion.id })
    .from(currentPublishedVersion)
    .where(eq(currentPublishedVersion.indicatorId, indicatorId));

  return published !== undefined;
}

async function replaceLists(
  tx: Transaction,
  versionId: string,
  { classificationIds, links, topicIds, numeratorSources, denominatorSources }: IndicatorDraftLists,
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

  if (links !== undefined) {
    await tx
      .delete(indicatorVersionLink)
      .where(eq(indicatorVersionLink.indicatorVersionId, versionId));
    if (links.length > 0) {
      await tx.insert(indicatorVersionLink).values(
        links.map(({ url, text }, position) => ({
          indicatorVersionId: versionId,
          position,
          url,
          text,
        })),
      );
    }
  }

  await replaceSources(tx, versionId, 'numerator', numeratorSources);
  await replaceSources(tx, versionId, 'denominator', denominatorSources);
}

async function replaceSources(
  tx: Transaction,
  versionId: string,
  part: schema.IndicatorSourcePart,
  sources: IndicatorDraftSource[] | undefined,
): Promise<void> {
  if (sources === undefined) return;

  await tx
    .delete(indicatorVersionSource)
    .where(
      and(
        eq(indicatorVersionSource.indicatorVersionId, versionId),
        eq(indicatorVersionSource.part, part),
      ),
    );

  if (sources.length > 0) {
    await tx.insert(indicatorVersionSource).values(
      sources.map(({ providerId, sourceId }, position) => ({
        indicatorVersionId: versionId,
        part,
        position,
        providerId,
        sourceId,
      })),
    );
  }
}
