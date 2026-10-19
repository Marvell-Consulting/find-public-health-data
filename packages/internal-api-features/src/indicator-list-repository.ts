import type { IndicatorListScope } from '@fphd/auth/permissions';
import { type Database, schema } from '@fphd/db';
import { asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { DraftStatus, IndicatorStatus } from './contract.ts';
import {
  currentName,
  draftJoin,
  draftStatus,
  draftVersion,
  indicatorStatus,
  latestUpdatedAt,
  latestUpdatedBy,
  publishedJoin,
  publishedVersion,
  publishedVersionJoin,
} from './indicator-repository-sql.ts';

const { appUser, currentPublishedVersion, indicator, indicatorVersion, team } = schema;

const firstVersion = alias(indicatorVersion, 'first_version');
const lastEditor = alias(appUser, 'last_editor');

export interface IndicatorAdminRow {
  id: string;
  name: string;
  teamId: string | null;
  updatedAt: Date;
  indicatorStatus: IndicatorStatus;
  draftStatus: DraftStatus | null;
}

/** A row of the dashboard, which names the team and the people as well as their ids. */
export interface IndicatorAdminListRow extends IndicatorAdminRow {
  teamName: string | null;
  createdBy: string | null;
  lastEditedBy: string | null;
}

export interface IndicatorAdminRows {
  indicators: IndicatorAdminListRow[];
  total: number;
}

export interface IndicatorAdminDetailRow extends IndicatorAdminRow {
  shortId: number;
  /** The published version's slug, and so its public address; null while none is published. */
  publishedSlug: string | null;
}

/**
 * The indicators in scope whatever their status, newest edit first; the id breaks any remaining
 * tie. The team and the people are joined into the same query, so a page costs two queries,
 * this and its count, however many rows it shows.
 */
export async function listIndicatorsPage(
  db: Database,
  page: number,
  pageSize: number,
  scope: IndicatorListScope,
): Promise<IndicatorAdminRows> {
  if (!scope.all && scope.teamIds.length === 0) return { indicators: [], total: 0 };

  const inScope = scope.all ? undefined : inArray(indicator.teamId, [...scope.teamIds]);
  // The indicator's first version, whatever has happened to it since, says who created it. As a
  // subquery in the select list, Postgres runs it after the sort, for the page's rows alone.
  const createdBy = sql<string | null>`(${db
    .select({ name: appUser.displayName })
    .from(firstVersion)
    .innerJoin(appUser, eq(appUser.id, firstVersion.createdBy))
    .where(eq(firstVersion.indicatorId, indicator.id))
    .orderBy(asc(firstVersion.createdAt), asc(firstVersion.id))
    .limit(1)})`;
  const [indicators, [counted]] = await Promise.all([
    db
      .select({
        id: indicator.id,
        name: currentName,
        teamId: indicator.teamId,
        teamName: team.name,
        createdBy,
        updatedAt: latestUpdatedAt,
        lastEditedBy: lastEditor.displayName,
        indicatorStatus,
        draftStatus,
      })
      .from(indicator)
      .leftJoin(draftVersion, draftJoin)
      .leftJoin(currentPublishedVersion, publishedJoin)
      .leftJoin(publishedVersion, publishedVersionJoin)
      .leftJoin(team, eq(team.id, indicator.teamId))
      .leftJoin(lastEditor, eq(lastEditor.id, latestUpdatedBy))
      .where(inScope)
      .orderBy(desc(latestUpdatedAt), asc(currentName), asc(indicator.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(indicator).where(inScope),
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
      teamId: indicator.teamId,
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

/** The team the indicator is in, null when it has none, or undefined when there is no such indicator. */
export async function findIndicatorTeamId(
  db: Database,
  id: string,
): Promise<string | null | undefined> {
  const [row] = await db
    .select({ teamId: indicator.teamId })
    .from(indicator)
    .where(eq(indicator.id, id));

  return row?.teamId;
}
