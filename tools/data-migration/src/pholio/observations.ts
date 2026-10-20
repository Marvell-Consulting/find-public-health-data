import type { ObservationExportOptions } from './context.ts';
import { ageValueIdForObservation, sexValueIdForObservation } from './dimensions.ts';
import {
  AGE_DIMENSION_TYPE_ID,
  categoryDimensionTypeId,
  categoryDimensionValueId,
  DIMENSION_SLOTS,
  observationDimensionId,
  observationId,
  observationNoteId,
  SEX_DIMENSION_TYPE_ID,
} from './ids.ts';
import { computeDates } from './period.ts';
import { queryPholio, streamPholio } from './source.ts';
import { TableWriter } from './table-writer.ts';

// ─── Sentinel / CI helpers ────────────────────────────────────────────────────

/** -1 is Pholio's null sentinel for numeric fields. */
export function nullIfSentinel(v: number | null): number | null {
  if (v === null || v === -1) return null;
  return v;
}

/**
 * denominator_2 is only stored when it differs from denominator (before sentinel removal).
 * Reproduces: CASE WHEN c.Denominator_2 != c.Denominator THEN NULLIF(c.Denominator_2,-1) ELSE NULL END
 */
export function computeDenominator2(
  denominator2Raw: number | null,
  denominatorRaw: number | null,
): number | null {
  if (denominator2Raw === null) return null;
  if (denominator2Raw === denominatorRaw) return null;
  return nullIfSentinel(denominator2Raw);
}

/**
 * CI pair with the inversion-swap rule (Step 6, lines 757–767).
 * When value = -1: both → null.
 * When value present, lower > upper and neither is -1: swap.
 * Otherwise: NULLIF individually.
 */
export function computeCiPair(
  valueRaw: number,
  lowerRaw: number | null,
  upperRaw: number | null,
): { lower: number | null; upper: number | null } {
  if (valueRaw === -1) return { lower: null, upper: null };
  const lo = lowerRaw ?? -1;
  const hi = upperRaw ?? -1;
  if (lo > hi && lo !== -1 && hi !== -1) {
    return { lower: nullIfSentinel(hi), upper: nullIfSentinel(lo) };
  }
  return { lower: nullIfSentinel(lo), upper: nullIfSentinel(hi) };
}

// ─── Compound sex+age ─────────────────────────────────────────────────────────

/** AgeIDs that decompose into a male+female pair of observation rows. */
export const COMPOUND_AGE_IDS = new Set([209, 212, 274]);

// ─── Dedup key ────────────────────────────────────────────────────────────────

/** Canonical observation identity within an indicator batch. */
export function dedupKey(
  indicatorId: number,
  areaId: number,
  fromDate: string,
  toDate: string,
  batchId: number,
  sortedDimValueIds: readonly number[],
): string {
  return `${indicatorId}|${areaId}|${fromDate}|${toDate}|${batchId}|${sortedDimValueIds.join(',')}`;
}

// ─── CoreDataSet row type ──────────────────────────────────────────────────────

interface CdsRow {
  uid: number;
  IndicatorID: number;
  AreaCode: string;
  Year: number;
  Month: number;
  Quarter: number;
  YearRange: number;
  YearTypeID: number | null;
  SexID: number;
  AgeID: number;
  CategoryTypeID: number;
  CategoryID: number;
  Value: number | null;
  Count: number | null;
  Denominator: number | null;
  Denominator_2: number | null;
  LowerCI95: number | null;
  UpperCI95: number | null;
  LowerCI99_8: number | null;
  UpperCI99_8: number | null;
  ValueNoteId: number;
}

interface ObservationDimension {
  slot: (typeof DIMENSION_SLOTS)[keyof typeof DIMENSION_SLOTS];
  typeId: number;
  valueId: number;
}

export function observationDimensions(
  c: Pick<CdsRow, 'SexID' | 'AgeID' | 'CategoryTypeID' | 'CategoryID'>,
): ObservationDimension[][] {
  const sexes = COMPOUND_AGE_IDS.has(c.AgeID) && c.SexID === 4 ? [1, 2] : [c.SexID];
  return sexes.map((sex) => {
    const dimensions: ObservationDimension[] = [];
    const sexValue = sexValueIdForObservation(sex);
    const ageValue = ageValueIdForObservation(
      c.AgeID,
      sexes.length === 2 ? (sex === 1 ? 'M' : 'F') : null,
    );
    if (sexValue !== null)
      dimensions.push({
        slot: DIMENSION_SLOTS.sex,
        typeId: SEX_DIMENSION_TYPE_ID,
        valueId: sexValue,
      });
    if (ageValue !== null)
      dimensions.push({
        slot: DIMENSION_SLOTS.age,
        typeId: AGE_DIMENSION_TYPE_ID,
        valueId: ageValue,
      });
    if (c.CategoryTypeID !== -1 && c.CategoryID !== -1)
      dimensions.push({
        slot: DIMENSION_SLOTS.category,
        typeId: categoryDimensionTypeId(c.CategoryTypeID),
        valueId: categoryDimensionValueId(c.CategoryTypeID, c.CategoryID),
      });
    return dimensions.sort((a, b) => a.valueId - b.valueId);
  });
}

export type ObservationExclusions = Record<
  | 'not_approved'
  | 'test_indicator'
  | 'excluded_indicator'
  | 'note_506'
  | 'empty_observation'
  | 'year_before_1900'
  | DuplicateResolution,
  number
>;

type DuplicateResolution = 'duplicate_placeholder' | 'duplicate_identical' | 'duplicate_superseded';

const MEASURES = [
  'Value',
  'Count',
  'Denominator',
  'Denominator_2',
  'LowerCI95',
  'UpperCI95',
  'LowerCI99_8',
  'UpperCI99_8',
  'ValueNoteId',
] as const;

function isPlaceholder(c: CdsRow): boolean {
  return c.Value === -1 && c.Count === -1 && c.Denominator === -1;
}

function sentinelCodes(c: CdsRow): number {
  return (c.SexID === -1 ? 1 : 0) + (c.AgeID === -1 ? 1 : 0) + (c.YearRange === -1 ? 1 : 0);
}

/**
 * Pholio keys rows on SexID, AgeID and YearRange, so a row coded "not applicable" (-1) can sit
 * beside the persons, all-ages or one-year row it duplicates. Each -1 maps to the same key here.
 * Keeps one row when the choice is safe: the only real row among placeholders, the coded row
 * among identical measures, or the coded row for indicators known to hold a stale sentinel copy.
 */
export function resolveDuplicateGroup(
  rows: readonly CdsRow[],
  supersededSentinelIndicators: ReadonlySet<number>,
): { keep: CdsRow; reasonFor: (dropped: CdsRow) => DuplicateResolution } | undefined {
  const real = rows.filter((c) => !isPlaceholder(c));
  const candidates = real.length > 0 ? real : rows;
  const [canonical] = [...candidates].sort(
    (a, b) => sentinelCodes(a) - sentinelCodes(b) || a.uid - b.uid,
  );
  if (!canonical) return undefined;
  const resolved = (keep: CdsRow, reason: DuplicateResolution) => ({
    keep,
    reasonFor: (dropped: CdsRow): DuplicateResolution =>
      isPlaceholder(dropped) && real.length > 0 ? 'duplicate_placeholder' : reason,
  });
  if (candidates.length === 1) return resolved(canonical, 'duplicate_placeholder');
  if (candidates.every((c) => MEASURES.every((measure) => c[measure] === canonical[measure])))
    return resolved(canonical, 'duplicate_identical');
  const coded = candidates.filter((c) => sentinelCodes(c) === 0);
  if (supersededSentinelIndicators.has(canonical.IndicatorID) && coded.length === 1 && coded[0])
    return resolved(coded[0], 'duplicate_superseded');
  return undefined;
}

function exclusionReason(
  c: CdsRow,
  excluded: ReadonlySet<number>,
  selection: ObservationExportOptions['indicatorSelection'],
  selected: ReadonlySet<number>,
): keyof ObservationExclusions | undefined {
  if (c.IndicatorID === 94204) return 'test_indicator';
  if (selection.kind === 'approved' && !selected.has(c.IndicatorID)) return 'not_approved';
  if (c.ValueNoteId === 506) return 'note_506';
  if (c.Value === -1 && c.Count === -1 && c.Denominator === -1 && c.ValueNoteId === 0)
    return 'empty_observation';
  if (c.Year < 1900) return 'year_before_1900';
  if (excluded.has(c.IndicatorID)) return 'excluded_indicator';
  return undefined;
}

const observationQuery = `
  SELECT c.uid, c.IndicatorID, c.AreaCode,
    c.Year, c.Month, c.Quarter, c.YearRange, im.YearTypeID,
    c.SexID, c.AgeID, c.CategoryTypeID, c.CategoryID,
    c.Value, c.Count, c.Denominator, c.Denominator_2,
    c.LowerCI95, c.UpperCI95, c.LowerCI99_8, c.UpperCI99_8, c.ValueNoteId
  FROM dbo.CoreDataSet c
  LEFT JOIN dbo.IndicatorMetadata im ON c.IndicatorID = im.IndicatorID
`;

async function assertDistinctObservations(
  context: ObservationExportOptions,
): Promise<{ exclusions: ObservationExclusions; dropped: ReadonlySet<number> }> {
  const exclusions: ObservationExclusions = {
    not_approved: 0,
    test_indicator: 0,
    excluded_indicator: 0,
    note_506: 0,
    empty_observation: 0,
    year_before_1900: 0,
    duplicate_placeholder: 0,
    duplicate_identical: 0,
    duplicate_superseded: 0,
  };
  const duplicates = new Map<string, number[]>();
  const excluded = new Set(context.excludedIndicators);
  const selected = new Set(
    context.indicatorSelection.kind === 'approved' ? context.indicatorSelection.indicators : [],
  );
  const seen = new Map<string, number>();
  let indicator: number | undefined;
  await streamPholio(context.pool, `${observationQuery} ORDER BY c.IndicatorID, c.uid`, (raw) => {
    const c = raw as unknown as CdsRow;
    const reason = exclusionReason(c, excluded, context.indicatorSelection, selected);
    if (reason) {
      exclusions[reason] += 1;
      return;
    }
    const diagnostic = `CoreDataSet uid ${c.uid}, indicator ${c.IndicatorID}`;
    if (!context.indicatorIds.has(c.IndicatorID))
      throw new Error(`${diagnostic}: missing indicator metadata`);
    const areaId = context.areaIdByPholioCode.get(c.AreaCode);
    if (areaId === undefined) throw new Error(`${diagnostic}: unknown area ${c.AreaCode}`);
    if (c.ValueNoteId !== 0 && !context.noteTypeCategory.has(c.ValueNoteId))
      throw new Error(`${diagnostic}: unknown note type ${c.ValueNoteId}`);
    // Any other sex would silently lose the age, as only SexID 4 is split into the sexed bands.
    if (COMPOUND_AGE_IDS.has(c.AgeID) && c.SexID !== 4)
      throw new Error(`${diagnostic}: compound age ${c.AgeID} with SexID ${c.SexID}, expected 4`);
    if (indicator !== c.IndicatorID) {
      seen.clear();
      indicator = c.IndicatorID;
    }
    const { fromDate, toDate } = computeDates(
      c.Year,
      c.Month,
      c.Quarter,
      c.YearRange,
      c.YearTypeID ?? 1,
    );
    for (const dimensions of observationDimensions(c)) {
      for (const dimension of dimensions) {
        if (!context.dimensionValueIds.has(dimension.valueId))
          throw new Error(`${diagnostic}: unknown dimension value ${dimension.valueId}`);
      }
      const key = dedupKey(
        c.IndicatorID,
        areaId,
        fromDate,
        toDate,
        c.IndicatorID,
        dimensions.map((d) => d.valueId),
      );
      const previous = seen.get(key);
      if (previous === undefined) seen.set(key, c.uid);
      else duplicates.set(key, [...(duplicates.get(key) ?? [previous]), c.uid]);
    }
  });
  const dropped = new Set<number>();
  if (duplicates.size === 0) return { exclusions, dropped };
  const rowsByUid = await sourceRowsByUid(context, [...duplicates.values()].flat());
  const superseded = new Set(context.supersededSentinelIndicators);
  const unresolved = new Map<number, string[]>();
  for (const [key, uids] of duplicates) {
    const rows = uids.map((uid) => {
      const row = rowsByUid.get(uid);
      if (!row) throw new Error(`CoreDataSet uid ${uid}: source changed after pre-flight`);
      return row;
    });
    const resolution = resolveDuplicateGroup(rows, superseded);
    if (!resolution) {
      const indicatorId = rows[0]?.IndicatorID ?? 0;
      const keys = unresolved.get(indicatorId) ?? [];
      keys.push(`${key} (CoreDataSet uids ${uids.join(', ')})`);
      unresolved.set(indicatorId, keys);
      continue;
    }
    for (const row of rows) {
      if (row.uid === resolution.keep.uid) continue;
      dropped.add(row.uid);
      exclusions[resolution.reasonFor(row)] += 1;
    }
  }
  if (unresolved.size > 0) {
    const total = [...unresolved.values()].reduce((sum, keys) => sum + keys.length, 0);
    const summary = [...unresolved]
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([indicatorId, keys]) => {
        const shown = keys.slice(0, 3).join('\n    ');
        const more = keys.length > 3 ? `\n    and ${keys.length - 3} more` : '';
        return `  indicator ${indicatorId}: ${keys.length} key(s)\n    ${shown}${more}`;
      });
    throw new Error(
      `${total} repeated observation key(s) across ${unresolved.size} indicator(s) could not be resolved; review the source rows before exporting:\n${summary.join('\n')}`,
    );
  }
  return { exclusions, dropped };
}

async function sourceRowsByUid(
  context: ObservationExportOptions,
  uids: readonly number[],
): Promise<Map<number, CdsRow>> {
  const rows = new Map<number, CdsRow>();
  for (let index = 0; index < uids.length; index += 500) {
    const chunk = uids.slice(index, index + 500);
    const query = `${observationQuery} WHERE c.uid IN (${chunk.join(', ')})`;
    for (const row of (await queryPholio(context.pool, query)) as unknown as CdsRow[])
      rows.set(row.uid, row);
  }
  return rows;
}

export async function exportObservations(context: ObservationExportOptions) {
  const { exclusions, dropped } = await assertDistinctObservations(context);
  const obsWriter = new TableWriter(context.outDir, 'observation');
  const dimWriter = new TableWriter(context.outDir, 'observation_dimension');
  const noteWriter = new TableWriter(context.outDir, 'observation_note');
  const excluded = new Set(context.excludedIndicators);
  const selected = new Set(
    context.indicatorSelection.kind === 'approved' ? context.indicatorSelection.indicators : [],
  );
  await streamPholio(context.pool, `${observationQuery} ORDER BY c.uid`, async (raw) => {
    const c = raw as unknown as CdsRow;
    if (exclusionReason(c, excluded, context.indicatorSelection, selected)) return;
    if (dropped.has(c.uid)) return;
    const areaId = context.areaIdByPholioCode.get(c.AreaCode);
    const enteredAt = context.indicatorEnteredAt.get(c.IndicatorID);
    if (areaId === undefined || enteredAt === undefined)
      throw new Error(`CoreDataSet uid ${c.uid}: source changed after pre-flight`);
    const { fromDate, toDate } = computeDates(
      c.Year,
      c.Month,
      c.Quarter,
      c.YearRange,
      c.YearTypeID ?? 1,
    );
    const value = nullIfSentinel(c.Value);
    const suppressed =
      value === null && context.noteTypeCategory.get(c.ValueNoteId) === 'disclosure';
    const ci95 = computeCiPair(c.Value ?? -1, c.LowerCI95, c.UpperCI95);
    const ci998 = computeCiPair(c.Value ?? -1, c.LowerCI99_8, c.UpperCI99_8);
    const halves = observationDimensions(c);
    for (const [split, dimensions] of halves.entries()) {
      const obsId = observationId(c.uid, split as 0 | 1);
      await obsWriter.write({
        id: obsId,
        indicator_id: c.IndicatorID,
        area_id: areaId,
        from_date: fromDate,
        to_date: toDate,
        value,
        count: suppressed ? null : nullIfSentinel(c.Count),
        denominator: suppressed ? null : nullIfSentinel(c.Denominator),
        denominator_2: suppressed
          ? null
          : computeDenominator2(c.Denominator_2, nullIfSentinel(c.Denominator)),
        lower_ci_95: ci95.lower,
        upper_ci_95: ci95.upper,
        lower_ci_998: ci998.lower,
        upper_ci_998: ci998.upper,
        distribution_rank: null,
        published_at: enteredAt,
        upload_batch_id: c.IndicatorID,
        dimension_key: dimensions.map((d) => d.valueId).join(','),
        created_at: enteredAt,
        created_by: 'pholio-migration',
        deleted_at: null,
      });
      for (const dimension of dimensions) {
        await dimWriter.write({
          id: observationDimensionId(obsId, dimension.slot),
          observation_id: obsId,
          dimension_value_id: dimension.valueId,
          dimension_type_id: dimension.typeId,
        });
      }
      if (c.ValueNoteId !== 0)
        await noteWriter.write({
          id: observationNoteId(obsId),
          observation_id: obsId,
          note_type_id: c.ValueNoteId,
        });
    }
  });
  return {
    observationExclusions: exclusions,
    tables: {
      observation: await obsWriter.close(),
      observation_dimension: await dimWriter.close(),
      observation_note: await noteWriter.close(),
    },
  };
}
