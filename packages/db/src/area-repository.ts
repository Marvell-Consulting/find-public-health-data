import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Database } from './client.js';
import { area, areaRelationship, areaType } from './schema/index.js';

export interface AreaSummary {
  code: string;
  name: string;
}

export interface AreaParent {
  code: string;
  parentCode: string;
  parentName: string;
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

/** Each given area's current parent of one area type, e.g. a council's statistical region. */
export async function listAreaParents(
  db: Database,
  childCodes: string[],
  parentTypeName: string,
): Promise<AreaParent[]> {
  if (childCodes.length === 0) {
    return [];
  }
  const parent = alias(area, 'parent');
  return db
    .select({ code: area.code, parentCode: parent.code, parentName: parent.name })
    .from(areaRelationship)
    .innerJoin(area, and(eq(areaRelationship.childAreaId, area.id), inArray(area.code, childCodes)))
    .innerJoin(parent, eq(areaRelationship.parentAreaId, parent.id))
    .innerJoin(areaType, and(eq(parent.areaTypeId, areaType.id), eq(areaType.name, parentTypeName)))
    .where(isNull(areaRelationship.validTo))
    .orderBy(asc(area.code));
}
