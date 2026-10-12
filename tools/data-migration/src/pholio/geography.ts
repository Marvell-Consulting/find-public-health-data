import type { PholioExportContext, StageResult } from './context.ts';
import { areaId, areaRelationshipId } from './ids.ts';
import { queryPholio } from './source.ts';
import { TableWriter } from './table-writer.ts';

export function areaTypeName(rawName: string, areaTypeId: number, isDuplicate: boolean): string {
  return isDuplicate ? `${rawName} [${areaTypeId}]` : rawName;
}

/**
 * Normalise an area-type name for duplicate detection, matching SQL Server's
 * default collation (SQL_Latin1_General_CP1_CI_AS): trailing spaces are ignored
 * and comparison is case-insensitive.
 */
export function normalizeAreaTypeName(n: string): string {
  return n.trimEnd().toLowerCase();
}

export function areaTypeHierarchyType(areaTypeClass: string | null, areaTypeId: number): string {
  const nhsIds = new Set([7, 66, 153, 154, 165, 166, 204, 221, 223]);
  if (nhsIds.has(areaTypeId)) return 'NHS';
  if (!areaTypeClass) return 'Administrative';
  if (/NHS|CCG|ICB/i.test(areaTypeClass)) return 'NHS';
  return 'Administrative';
}

export function stripLeadingN(code: string): string {
  return code.startsWith('n') || code.startsWith('N') ? code.slice(1) : code;
}

/** Exports area_type, area and area_relationship from Pholio. */
export async function exportGeography(context: PholioExportContext): Promise<StageResult> {
  const { pool, outDir } = context;

  const areaTypeWriter = new TableWriter(outDir, 'area_type');
  const areaWriter = new TableWriter(outDir, 'area');
  const areaRelWriter = new TableWriter(outDir, 'area_relationship');

  // area_type: deduplicate names, assign hierarchy_type and level from Pholio
  const areaTypeRows = await queryPholio<{
    AreaTypeID: number;
    AreaType: string;
    AreaTypeClass: string | null;
    Sequence: number | null;
  }>(pool, 'SELECT AreaTypeID, AreaType, AreaTypeClass, Sequence FROM L_AreaTypes');

  // Find which names appear more than once, matching SQL Server collation:
  // trailing spaces and case differences are ignored.
  const nameCounts = new Map<string, number>();
  for (const r of areaTypeRows) {
    const key = normalizeAreaTypeName(r.AreaType);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  await areaTypeWriter.writeAll(
    areaTypeRows.map((r) => ({
      id: r.AreaTypeID,
      name: areaTypeName(
        r.AreaType,
        r.AreaTypeID,
        (nameCounts.get(normalizeAreaTypeName(r.AreaType)) ?? 1) > 1,
      ),
      hierarchy_type: areaTypeHierarchyType(r.AreaTypeClass, r.AreaTypeID),
      level: r.Sequence ?? 0,
    })),
  );

  // area: strip leading 'n', fall back name to AreaCode, hard-coded dates.
  // When stripping 'n' produces a code that was already emitted for the same validity window
  // (valid_from=2000-01-01 and same valid_to), the duplicate would violate the exclusion
  // constraint in the target Postgres schema (area_code_validity_excl). The non-n-prefixed row
  // is always encountered first (ASCII 'S' < 'n') so the n-prefixed duplicate is skipped here,
  // reproducing the 73,299 row count of the alpha output.
  const areaRows = await queryPholio<{
    AreaCode: string;
    AreaName: string | null;
    AreaTypeID: number;
    IsCurrent: boolean;
  }>(pool, 'SELECT AreaCode, AreaName, AreaTypeID, IsCurrent FROM L_Areas');

  // Track emitted (strippedCode, areaTypeId, valid_to) triples to detect duplicates.
  // Two rows with the same stripped code, same area_type_id, and overlapping validity windows
  // are the only cases that would collide in Postgres. Since valid_from is always 2000-01-01,
  // rows collide iff they have the same stripped code AND (same valid_to OR one has NULL valid_to).
  // In practice all 3 collisions are IsCurrent=true (valid_to NULL) + IsCurrent=false (2024-12-31
  // is different) so the actual collision is NULL vs NULL — both n-prefixed and non-prefixed have
  // the same IsCurrent. To faithfully reproduce parity: track (strippedCode, areaTypeId, validTo)
  // and skip on collision.
  type AreaKey = string;
  const emitted = new Set<AreaKey>();
  const areaRowsSorted = areaRows; // use L_Areas table scan order (AreaCode is PK, scan is key order)

  // id collision detection for areaId (SHA-based hash)
  const idToCode = new Map<number, string>();

  const areaExportRows: Array<{
    id: number;
    code: string;
    name: string;
    area_type_id: number;
    valid_from: string;
    valid_to: string | null;
  }> = [];

  for (const r of areaRowsSorted) {
    const stripped = stripLeadingN(r.AreaCode);
    const validTo = r.IsCurrent ? null : '2024-12-31';
    const key: AreaKey = `${stripped}\u0000${r.AreaTypeID}\u0000${validTo ?? ''}`;

    if (emitted.has(key)) {
      // Duplicate produced by stripping 'n': skip (matches alpha migration behaviour)
      continue;
    }
    emitted.add(key);

    const id = areaId(r.AreaCode);
    const existing = idToCode.get(id);
    if (existing !== undefined && existing !== r.AreaCode) {
      throw new Error(
        `areaId hash collision: AreaCode ${r.AreaCode} and ${existing} both map to id ${id}`,
      );
    }
    idToCode.set(id, r.AreaCode);

    // Map original Pholio AreaCode → exported id (used by observations stage for CoreDataSet.AreaCode lookup)
    context.areaIdByPholioCode.set(r.AreaCode, id);

    areaExportRows.push({
      id,
      code: stripped,
      name: r.AreaName ?? r.AreaCode,
      area_type_id: r.AreaTypeID,
      valid_from: '2000-01-01',
      valid_to: validTo,
    });
  }

  await areaWriter.writeAll(areaExportRows);

  // area_relationship: from L_AreaMapping; DISTINCT (parent, child) pairs.
  // Both child and parent AreaCodes are resolved via areaIdByPholioCode (the original Pholio code,
  // before any 'n' strip). When a code is ambiguous (same code, different area_type_id), the alpha
  // used MIN(fphd_id) over all area_type_ids — meaning the lowest sequential IDENTITY id. Here we
  // reproduce that with MIN(areaId) over all mapped ids for a given code, since areaId is a hash
  // keyed on the original AreaCode (unique per original code) and the duplicate-skipping above
  // means each original code maps to exactly one id. Ambiguity in L_AreaMapping comes from areas
  // that share the same AreaCode across multiple area types — the context map stores the id for
  // EACH original AreaCode, so there is no ambiguity; a code that appears under two area types
  // will have two distinct original AreaCodes (or the same AreaCode under different AreaTypeIDs,
  // but L_Areas.AreaCode is the PK so each original code is unique). The MIN(fphd_id) rule from
  // the alpha therefore never fires here: every (original AreaCode) maps to exactly one id.
  const mappingRows = await queryPholio<{
    ChildLevelGeographyCode: string;
    ParentLevelGeographyCode: string;
  }>(pool, 'SELECT DISTINCT ChildLevelGeographyCode, ParentLevelGeographyCode FROM L_AreaMapping');

  // id collision detection for relationships
  const relIdToKey = new Map<number, string>();
  const relExportRows: Array<{
    id: number;
    parent_area_id: number;
    child_area_id: number;
    valid_from: string;
    valid_to: null;
  }> = [];
  const seenRels = new Set<string>();

  for (const r of mappingRows) {
    const parentId = context.areaIdByPholioCode.get(r.ParentLevelGeographyCode);
    const childId = context.areaIdByPholioCode.get(r.ChildLevelGeographyCode);
    // Skip relationships where either end was not exported (e.g. codes not in L_Areas)
    if (parentId === undefined || childId === undefined) continue;

    const relKey = `${parentId}\u0000${childId}`;
    if (seenRels.has(relKey)) continue;
    seenRels.add(relKey);

    const id = areaRelationshipId(r.ParentLevelGeographyCode, r.ChildLevelGeographyCode);
    const existingKey = relIdToKey.get(id);
    if (existingKey !== undefined && existingKey !== relKey) {
      throw new Error(
        `areaRelationshipId hash collision: ${r.ParentLevelGeographyCode}→${r.ChildLevelGeographyCode} and existing ${existingKey} both map to ${id}`,
      );
    }
    relIdToKey.set(id, relKey);

    relExportRows.push({
      id,
      parent_area_id: parentId,
      child_area_id: childId,
      valid_from: '2000-01-01',
      valid_to: null,
    });
  }

  await areaRelWriter.writeAll(relExportRows);

  return {
    area_type: await areaTypeWriter.close(),
    area: await areaWriter.close(),
    area_relationship: await areaRelWriter.close(),
  };
}
