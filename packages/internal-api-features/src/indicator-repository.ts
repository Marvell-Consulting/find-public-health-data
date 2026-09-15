import { type Database, type IndicatorStatus, schema } from '@fphd/db';
import { asc, count, desc, eq } from 'drizzle-orm';

const { indicator } = schema;

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
  fingertipsId: number;
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

/** One indicator by its row id, whatever its status. */
export async function getIndicatorById(
  db: Database,
  id: string,
): Promise<IndicatorAdminDetailRow | undefined> {
  const rows = await db
    .select({
      id: indicator.id,
      fingertipsId: indicator.fingertipsId,
      name: indicator.name,
      status: indicator.status,
      updatedAt: indicator.updatedAt,
    })
    .from(indicator)
    .where(eq(indicator.id, id));

  return rows[0];
}
