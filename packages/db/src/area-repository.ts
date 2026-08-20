import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Database } from './client.js';
import { area, areaType } from './schema/index.js';

export interface AreaSummary {
  code: string;
  name: string;
}

/** Current areas (open validity window) of one area type, ordered by name. */
export async function listAreasByType(db: Database, areaTypeName: string): Promise<AreaSummary[]> {
  return db
    .select({ code: area.code, name: area.name })
    .from(area)
    .innerJoin(areaType, eq(area.areaTypeId, areaType.id))
    .where(and(eq(areaType.name, areaTypeName), isNull(area.validTo)))
    .orderBy(asc(area.name));
}
