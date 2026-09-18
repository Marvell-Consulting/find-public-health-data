import { and, asc, eq, ilike, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Database } from './client.ts';
import { area, areaRelationship, areaType } from './schema/index.ts';

export interface AreaSummary {
  code: string;
  name: string;
}

/** The user-facing geography levels in display order, straight from area_type. */
export async function listDisplayGroups(db: Database): Promise<string[]> {
  const rows = await db
    .selectDistinct({ name: areaType.displayGroup, order: areaType.displayOrder })
    .from(areaType)
    .where(isNotNull(areaType.displayGroup))
    .orderBy(asc(areaType.displayOrder));
  return rows.flatMap(({ name }) => (name === null ? [] : [name]));
}

/** Current areas across every type of one display group, ordered by name and code. */
export async function listAreasByGroup(
  db: Database,
  displayGroup: string,
  limit?: number,
): Promise<AreaSummary[]> {
  const query = db
    .select({ code: area.code, name: area.name })
    .from(area)
    .innerJoin(areaType, eq(area.areaTypeId, areaType.id))
    .where(and(eq(areaType.displayGroup, displayGroup), isNull(area.validTo)))
    .orderBy(asc(area.name), asc(area.code));
  return limit === undefined ? query : query.limit(limit);
}

/** Bounded previews for several display groups in one repository query. */
export async function listAreasByGroups(
  db: Database,
  displayGroups: string[],
  limit?: number,
): Promise<{ displayGroup: string; areas: AreaSummary[] }[]> {
  if (displayGroups.length === 0) return [];
  const ranked = db
    .select({
      displayGroup: areaType.displayGroup,
      code: area.code,
      name: area.name,
      rank: sql<number>`row_number() over (partition by ${areaType.displayGroup} order by ${area.name}, ${area.code})`.as(
        'rank',
      ),
    })
    .from(area)
    .innerJoin(areaType, eq(area.areaTypeId, areaType.id))
    .where(and(inArray(areaType.displayGroup, displayGroups), isNull(area.validTo)))
    .as('ranked_areas');
  const rows = await db
    .select({ displayGroup: ranked.displayGroup, code: ranked.code, name: ranked.name })
    .from(ranked)
    .where(limit === undefined ? undefined : lte(ranked.rank, limit))
    .orderBy(asc(ranked.displayGroup), asc(ranked.name), asc(ranked.code));
  const groups = new Map(displayGroups.map((displayGroup) => [displayGroup, [] as AreaSummary[]]));
  for (const row of rows) {
    if (row.displayGroup) groups.get(row.displayGroup)?.push({ code: row.code, name: row.name });
  }
  return [...groups].map(([displayGroup, areas]) => ({ displayGroup, areas }));
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
  displayGroup: string | null;
}

/** The given areas with their types, for resolving a selection without the full catalogue. */
export async function listAreasByCodes(db: Database, codes: string[]): Promise<AreaLookup[]> {
  if (codes.length === 0) {
    return [];
  }
  return db
    .select({
      code: area.code,
      name: area.name,
      areaType: areaType.name,
      displayGroup: areaType.displayGroup,
    })
    .from(area)
    .innerJoin(areaType, eq(area.areaTypeId, areaType.id))
    .where(and(inArray(area.code, codes), isNull(area.validTo)))
    .orderBy(asc(area.name));
}

/** Case-insensitive search over current areas of displayed types, matching name or code. */
export async function searchAreas(
  db: Database,
  query: string,
  limit: number,
): Promise<AreaLookup[]> {
  const escaped = query.replace(/[\\%_]/g, '\\$&');
  return db
    .select({
      code: area.code,
      name: area.name,
      areaType: areaType.name,
      displayGroup: areaType.displayGroup,
    })
    .from(area)
    .innerJoin(areaType, and(eq(area.areaTypeId, areaType.id), isNotNull(areaType.displayGroup)))
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
