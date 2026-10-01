import { type Database, schema } from '@fphd/db';
import { asc, count, desc, eq } from 'drizzle-orm';

import type { DraftStatus, IndicatorStatus } from './contract.ts';
import {
  currentName,
  draftJoin,
  draftStatus,
  draftVersion,
  indicatorStatus,
  latestUpdatedAt,
  publishedJoin,
  publishedVersion,
  publishedVersionJoin,
} from './indicator-repository-sql.ts';

const { currentPublishedVersion, indicator } = schema;

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
