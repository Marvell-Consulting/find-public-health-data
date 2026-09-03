import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
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

export interface AreaLookup {
  code: string;
  name: string;
  areaType: string;
}

/** The given areas with their types, for resolving a selection without the full catalogue. */
export async function listAreasByCodes(db: Database, codes: string[]): Promise<AreaLookup[]> {
  if (codes.length === 0) {
    return [];
  }
  return db
    .select({ code: area.code, name: area.name, areaType: areaType.name })
    .from(area)
    .innerJoin(areaType, eq(area.areaTypeId, areaType.id))
    .where(and(inArray(area.code, codes), isNull(area.validTo)))
    .orderBy(asc(area.name));
}

/** Case-insensitive search over current areas of the given types, matching name or code. */
export async function searchAreas(
  db: Database,
  query: string,
  areaTypeNames: string[],
  limit: number,
): Promise<AreaLookup[]> {
  if (areaTypeNames.length === 0) {
    return [];
  }
  const escaped = query.replace(/[\\%_]/g, '\\$&');
  return db
    .select({ code: area.code, name: area.name, areaType: areaType.name })
    .from(area)
    .innerJoin(
      areaType,
      and(eq(area.areaTypeId, areaType.id), inArray(areaType.name, areaTypeNames)),
    )
    .where(
      and(isNull(area.validTo), or(ilike(area.name, `%${escaped}%`), ilike(area.code, escaped))),
    )
    .orderBy(sql`position(lower(${query}) in lower(${area.name}))`, asc(area.name))
    .limit(limit);
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
