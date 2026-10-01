import { type Database, schema } from '@fphd/db';
import { and, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { DraftStatus, IndicatorStatus } from './contract.ts';

const { currentPublishedVersion, indicator, indicatorVersion } = schema;

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const UNIQUE_VIOLATION = '23505';
// The slug exclusion constraint: another indicator already holds the slug this name yields.
export const EXCLUSION_VIOLATION = '23P01';

/** Drizzle wraps the driver error, so the SQLSTATE is on a `cause` rather than the error thrown. */
export function hasSqlState(error: unknown, sqlState: string): boolean {
  for (let current = error; current !== null && current !== undefined; ) {
    if (typeof current !== 'object') return false;
    if ('code' in current && (current as { code?: unknown }).code === sqlState) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * The one-draft index makes the draft join one row, and currentPublishedVersion is one row
 * per indicator, so an indicator's draft and published versions can be read side by side.
 * The view names the published version; its columns come from the version table by id.
 */
export const draftVersion = alias(indicatorVersion, 'draft_version');
export const publishedVersion = alias(indicatorVersion, 'published_version');

export const draftJoin = and(
  eq(draftVersion.indicatorId, indicator.id),
  eq(draftVersion.status, 'draft'),
);
export const publishedJoin = eq(currentPublishedVersion.indicatorId, indicator.id);
export const publishedVersionJoin = eq(publishedVersion.id, currentPublishedVersion.id);

// The draft is what a publisher is working on, so it names the indicator while it exists.
export const currentName = sql<string>`coalesce(${draftVersion.name}, ${publishedVersion.name})`;
// greatest() ignores nulls, so an indicator with only one version still reports its date.
// mapWith, because a bare sql fragment arrives as the driver's string, not a Date.
export const latestUpdatedAt =
  sql`greatest(${draftVersion.updatedAt}, ${publishedVersion.updatedAt})`.mapWith(
    indicatorVersion.updatedAt,
  );
// Both statuses are read from the versions as SQL, so a filter or sort on either is a WHERE clause.
export const indicatorStatus = sql<IndicatorStatus>`case when ${currentPublishedVersion.id} is not null then 'live' else 'new' end`;
// The draft join fixes the status it matches, which narrows the column from the version enum.
export const draftStatus = sql<DraftStatus | null>`${draftVersion.status}`;
