import { asc, desc, eq, sql } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';

import { indicatorVersion } from './schema/index.ts';

/**
 * An indicator may hold several published versions, so "the published version" means the
 * most recently published one, ties broken by id — UUIDv7, so that orders by creation.
 * The `published` views select on the same rule; this is it for queries over the tables.
 *
 * The builder carries its own casing setting: unlike a query started from a `Database`, it
 * has no connection to take one from, and without it the columns render as their
 * TypeScript names. Only the columns callers read are selected.
 */
export const latestPublishedVersion = new QueryBuilder({ casing: 'snake_case' })
  .selectDistinctOn([indicatorVersion.indicatorId], {
    id: indicatorVersion.id,
    indicatorId: indicatorVersion.indicatorId,
    name: indicatorVersion.name,
    updatedAt: indicatorVersion.updatedAt,
  })
  .from(indicatorVersion)
  .where(eq(indicatorVersion.status, 'published'))
  .orderBy(
    asc(indicatorVersion.indicatorId),
    sql`${indicatorVersion.publishedAt} desc nulls last`,
    desc(indicatorVersion.id),
  )
  .as('published_version');
