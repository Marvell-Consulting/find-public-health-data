import { type Database, schema } from '@fphd/db';
import { asc, count, desc } from 'drizzle-orm';

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
