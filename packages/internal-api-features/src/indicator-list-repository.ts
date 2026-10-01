import { type Database, schema } from '@fphd/db';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { DraftStatus, IndicatorStatus } from './contract.ts';

const { currentPublishedVersion, indicator, indicatorVersion } = schema;

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
export const draftVersion = alias(indicatorVersion, 'draft_version');
const publishedVersion = alias(indicatorVersion, 'published_version');

export const draftJoin = and(
  eq(draftVersion.indicatorId, indicator.id),
  eq(draftVersion.status, 'draft'),
);
export const publishedJoin = eq(currentPublishedVersion.indicatorId, indicator.id);
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
export const indicatorStatus = sql<IndicatorStatus>`case when ${currentPublishedVersion.id} is not null then 'live' else 'new' end`;
// The draft join fixes the status it matches, which narrows the column from the version enum.
export const draftStatus = sql<DraftStatus | null>`${draftVersion.status}`;

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
