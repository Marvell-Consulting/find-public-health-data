import { type Database, type IndicatorStatus, schema } from '@fphd/db';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const { indicator, indicatorAlias } = schema;

const canonicalAlias = alias(indicatorAlias, 'canonical_alias');
const numberAlias = alias(indicatorAlias, 'number_alias');

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
  /** The indicator's number, which it has from the moment it is created. */
  number: number;
  /** The address the public site serves it at, null until something is published. */
  slug: string | null;
  status: IndicatorStatus;
}

/** Every indicator whatever its status, newest edit first; the id breaks any remaining tie. */
export async function listIndicatorsPage(
  db: Database,
  page: number,
  pageSize: number,
): Promise<IndicatorAdminRows> {
  const [indicators, [counted]] = await Promise.all([
    db
      .select({ id: indicator.id, name: indicator.name, updatedAt: indicator.updatedAt })
      .from(indicator)
      .orderBy(desc(indicator.updatedAt), asc(indicator.name), asc(indicator.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(indicator),
  ]);

  return { indicators, total: counted?.total ?? 0 };
}

/** One indicator by its row id, whatever its status, with the aliases it answers to. */
export async function getIndicatorById(
  db: Database,
  id: string,
): Promise<IndicatorAdminDetailRow | undefined> {
  const rows = await db
    .select({
      id: indicator.id,
      number: sql<number>`${numberAlias.slug}::int`,
      slug: canonicalAlias.slug,
      name: indicator.name,
      status: indicator.status,
      updatedAt: indicator.updatedAt,
    })
    .from(indicator)
    .innerJoin(
      numberAlias,
      and(eq(numberAlias.indicatorId, indicator.id), sql`${numberAlias.slug} ~ '^[0-9]+$'`),
    )
    .leftJoin(
      canonicalAlias,
      and(eq(canonicalAlias.indicatorId, indicator.id), eq(canonicalAlias.isCanonical, true)),
    )
    .where(eq(indicator.id, id));

  return rows[0];
}
