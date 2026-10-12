import type { PholioExportContext, StageResult } from './context.ts';
import {
  AGE_DIMENSION_TYPE_ID,
  ageDimensionValueId,
  categoryDimensionTypeId,
  categoryDimensionValueId,
  compoundAgeDimensionValueId,
  DIMENSION_SLOTS,
  observationDimensionId,
  observationId,
  observationNoteId,
  SEX_DIMENSION_TYPE_ID,
  sexDimensionValueId,
} from './ids.ts';
import { computeDates } from './period.ts';
import { streamPholio } from './source.ts';
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

/**
 * Dimension value ids for the two halves of a compound sex+age split.
 * AgeID 274 male intentionally reuses the 209M code (matches alpha SQL bug/design, line 848).
 */
export function compoundAgeDimensionValueIds(ageId: number): {
  maleDvId: number;
  femaleDvId: number;
} {
  switch (ageId) {
    case 209:
      return {
        maleDvId: compoundAgeDimensionValueId(209, 'M'),
        femaleDvId: compoundAgeDimensionValueId(209, 'F'),
      };
    case 212:
      return {
        maleDvId: compoundAgeDimensionValueId(212, 'M'),
        femaleDvId: compoundAgeDimensionValueId(212, 'F'),
      };
    case 274:
      return {
        maleDvId: compoundAgeDimensionValueId(209, 'M'),
        femaleDvId: compoundAgeDimensionValueId(274, 'F'),
      };
    default:
      throw new Error(`AgeID ${ageId} is not a compound age`);
  }
}

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

// ─── Dedup pass (Pass 1) ──────────────────────────────────────────────────────

/** Checks canonical keys before writing observations; source order bounds memory per indicator. */
async function assertDistinctObservations(
  context: Pick<
    PholioExportContext,
    'pool' | 'excludedIndicators' | 'areaIdByPholioCode' | 'indicatorIds'
  >,
): Promise<void> {
  const { pool, areaIdByPholioCode, indicatorIds } = context;
  const excludedSet = new Set(context.excludedIndicators);
  excludedSet.add(94204);

  const perIndicatorSeen = new Map<string, number>();
  let currentIndicatorId: number | undefined;

  const query = `
    SELECT
      c.uid, c.IndicatorID, c.AreaCode,
      c.Year, c.Month, c.Quarter, c.YearRange,
      im.YearTypeID,
      c.SexID, c.AgeID, c.CategoryTypeID, c.CategoryID
    FROM dbo.CoreDataSet c
    JOIN dbo.IndicatorMetadata im ON c.IndicatorID = im.IndicatorID
    WHERE c.IndicatorID != 94204
      AND c.ValueNoteId != 506
      AND NOT (c.Value = -1 AND c.Count = -1 AND c.Denominator = -1 AND c.ValueNoteId = 0)
      AND c.Year >= 1900
    ORDER BY c.IndicatorID, c.uid
  `;

  await streamPholio(pool, query, (raw) => {
    const c = raw as unknown as Pick<
      CdsRow,
      | 'uid'
      | 'IndicatorID'
      | 'AreaCode'
      | 'Year'
      | 'Month'
      | 'Quarter'
      | 'YearRange'
      | 'YearTypeID'
      | 'SexID'
      | 'AgeID'
      | 'CategoryTypeID'
      | 'CategoryID'
    >;

    // Clear per-indicator state at each boundary — valid by construction (ORDER BY IndicatorID).
    if (c.IndicatorID !== currentIndicatorId) {
      perIndicatorSeen.clear();
      currentIndicatorId = c.IndicatorID;
    }

    if (excludedSet.has(c.IndicatorID)) return;
    if (!indicatorIds.has(c.IndicatorID)) return;

    const areaId = areaIdByPholioCode.get(c.AreaCode);
    if (areaId === undefined) return;

    const yearTypeId = c.YearTypeID ?? 1;
    const uploadBId = c.IndicatorID;

    const { fromDate, toDate } = computeDates(c.Year, c.Month, c.Quarter, c.YearRange, yearTypeId);

    const checkAndMark = (obsId: number, dimIds: readonly number[]): void => {
      const sortedIds = [...dimIds].sort((a, b) => a - b);
      const dk = dedupKey(c.IndicatorID, areaId, fromDate, toDate, uploadBId, sortedIds);
      const previous = perIndicatorSeen.get(dk);
      if (previous !== undefined) {
        throw new Error(
          `Indicator ${c.IndicatorID} has repeated observation key ${dk} (CoreDataSet uids ${Math.floor(previous / 2)}, ${c.uid}); review the source rows before exporting`,
        );
      }
      perIndicatorSeen.set(dk, obsId);
    };

    if (COMPOUND_AGE_IDS.has(c.AgeID) && c.SexID === 4) {
      const { maleDvId, femaleDvId } = compoundAgeDimensionValueIds(c.AgeID);
      const maleSexDvId = sexDimensionValueId(1);
      const femaleSexDvId = sexDimensionValueId(2);
      const catDvId =
        c.CategoryTypeID !== -1 && c.CategoryID !== -1
          ? categoryDimensionValueId(c.CategoryTypeID, c.CategoryID)
          : null;

      const maleDims: number[] = [maleSexDvId, maleDvId];
      const femaleDims: number[] = [femaleSexDvId, femaleDvId];
      if (catDvId !== null) {
        maleDims.push(catDvId);
        femaleDims.push(catDvId);
      }

      checkAndMark(observationId(c.uid, 0), maleDims);
      checkAndMark(observationId(c.uid, 1), femaleDims);
    } else {
      const dimIds: number[] = [];
      if (c.SexID === 1 || c.SexID === 2) dimIds.push(sexDimensionValueId(c.SexID));
      if (!COMPOUND_AGE_IDS.has(c.AgeID) && c.AgeID !== -1 && c.AgeID !== 1) {
        dimIds.push(ageDimensionValueId(c.AgeID === 325 ? 303 : c.AgeID));
      }
      if (c.CategoryTypeID !== -1 && c.CategoryID !== -1) {
        dimIds.push(categoryDimensionValueId(c.CategoryTypeID, c.CategoryID));
      }
      checkAndMark(observationId(c.uid, 0), dimIds);
    }
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/** Exports observation, observation_dimension and observation_note from Pholio. */
export async function exportObservations(context: PholioExportContext): Promise<StageResult> {
  const {
    pool,
    outDir,
    excludedIndicators,
    areaIdByPholioCode,
    noteTypeCategory,
    dimensionValueIds,
    indicatorEnteredAt,
  } = context;

  const excludedSet = new Set(excludedIndicators);
  excludedSet.add(94204);

  await assertDistinctObservations(context);

  const obsWriter = new TableWriter(outDir, 'observation');
  const dimWriter = new TableWriter(outDir, 'observation_dimension');
  const noteWriter = new TableWriter(outDir, 'observation_note');

  let excludedCount = 0;

  const query = `
    SELECT
      c.uid, c.IndicatorID, c.AreaCode,
      c.Year, c.Month, c.Quarter, c.YearRange,
      im.YearTypeID,
      c.SexID, c.AgeID, c.CategoryTypeID, c.CategoryID,
      c.Value, c.Count, c.Denominator, c.Denominator_2,
      c.LowerCI95, c.UpperCI95, c.LowerCI99_8, c.UpperCI99_8,
      c.ValueNoteId
    FROM dbo.CoreDataSet c
    JOIN dbo.IndicatorMetadata im ON c.IndicatorID = im.IndicatorID
    WHERE c.IndicatorID != 94204
      AND c.ValueNoteId != 506
      AND NOT (c.Value = -1 AND c.Count = -1 AND c.Denominator = -1 AND c.ValueNoteId = 0)
      AND c.Year >= 1900
    ORDER BY c.uid
  `;

  await streamPholio(pool, query, (raw) => {
    const c = raw as unknown as CdsRow;

    if (excludedSet.has(c.IndicatorID)) {
      excludedCount += 1;
      return;
    }
    const enteredAt = indicatorEnteredAt.get(c.IndicatorID);
    if (enteredAt === undefined) return;

    const areaId = areaIdByPholioCode.get(c.AreaCode);
    if (areaId === undefined) return;

    const yearTypeId = c.YearTypeID ?? 1;
    const uploadBId = c.IndicatorID; // uploadBatchId(indicatorId) = indicatorId by design

    const { fromDate, toDate } = computeDates(c.Year, c.Month, c.Quarter, c.YearRange, yearTypeId);

    // ── Value / CI transforms ──
    const rawValue = c.Value ?? -1;
    const rawCount = c.Count ?? -1;
    const rawDenom = c.Denominator ?? -1;
    const rawDenom2 = c.Denominator_2 ?? null;

    const value = nullIfSentinel(rawValue);
    let count = nullIfSentinel(rawCount);
    let denominator = nullIfSentinel(rawDenom);
    let denominator2 = computeDenominator2(rawDenom2, rawDenom === -1 ? null : rawDenom);
    const ci95 = computeCiPair(rawValue, c.LowerCI95 ?? -1, c.UpperCI95 ?? -1);
    const ci998 = computeCiPair(rawValue, c.LowerCI99_8 ?? -1, c.UpperCI99_8 ?? -1);

    // ── Note presence ──
    const hasNote =
      c.ValueNoteId !== 0 && c.ValueNoteId !== 506 && noteTypeCategory.has(c.ValueNoteId);
    const noteIsDisclosure = hasNote && noteTypeCategory.get(c.ValueNoteId) === 'disclosure';

    // ── Disclosure suppression (Step 9 + fix-migration-gaps re-application) ──
    if (value === null && noteIsDisclosure) {
      count = null;
      denominator = null;
      denominator2 = null;
    }

    // ── Compound sex+age split (AgeID 209/212/274, SexID=4) ──
    if (COMPOUND_AGE_IDS.has(c.AgeID) && c.SexID === 4) {
      return writeCompoundRow(
        c,
        areaId,
        fromDate,
        toDate,
        uploadBId,
        value,
        count,
        denominator,
        denominator2,
        ci95,
        ci998,
        hasNote,
        obsWriter,
        dimWriter,
        noteWriter,
        enteredAt,
        dimensionValueIds,
      );
    }

    // ── Normal row ──

    const sexIdForBridge = c.SexID === 1 || c.SexID === 2 ? c.SexID : null;
    const ageDvId =
      !COMPOUND_AGE_IDS.has(c.AgeID) && c.AgeID !== -1 && c.AgeID !== 1
        ? ageDimensionValueId(c.AgeID === 325 ? 303 : c.AgeID)
        : null;
    const catDvId =
      c.CategoryTypeID !== -1 && c.CategoryID !== -1
        ? categoryDimensionValueId(c.CategoryTypeID, c.CategoryID)
        : null;
    const catDtId = catDvId !== null ? categoryDimensionTypeId(c.CategoryTypeID) : null;

    const dimIds: number[] = [];
    if (sexIdForBridge !== null) dimIds.push(sexDimensionValueId(sexIdForBridge));
    if (ageDvId !== null) dimIds.push(ageDvId);
    if (catDvId !== null) dimIds.push(catDvId);
    dimIds.sort((a, b) => a - b);

    const obsId = observationId(c.uid, 0);

    return (async () => {
      await obsWriter.write({
        id: obsId,
        indicator_id: c.IndicatorID,
        area_id: areaId,
        from_date: fromDate,
        to_date: toDate,
        value,
        count,
        denominator,
        denominator_2: denominator2,
        lower_ci_95: ci95.lower,
        upper_ci_95: ci95.upper,
        lower_ci_998: ci998.lower,
        upper_ci_998: ci998.upper,
        distribution_rank: null,
        published_at: enteredAt,
        upload_batch_id: uploadBId,
        dimension_key: dimIds.join(','),
        created_at: enteredAt,
        created_by: 'pholio-migration',
        deleted_at: null,
      });

      if (sexIdForBridge !== null) {
        const sdvId = sexDimensionValueId(sexIdForBridge);
        dimensionValueIds.add(sdvId);
        await dimWriter.write({
          id: observationDimensionId(obsId, DIMENSION_SLOTS.sex),
          observation_id: obsId,
          dimension_value_id: sdvId,
          dimension_type_id: SEX_DIMENSION_TYPE_ID,
        });
      }
      if (ageDvId !== null) {
        dimensionValueIds.add(ageDvId);
        await dimWriter.write({
          id: observationDimensionId(obsId, DIMENSION_SLOTS.age),
          observation_id: obsId,
          dimension_value_id: ageDvId,
          dimension_type_id: AGE_DIMENSION_TYPE_ID,
        });
      }
      if (catDvId !== null && catDtId !== null) {
        dimensionValueIds.add(catDvId);
        await dimWriter.write({
          id: observationDimensionId(obsId, DIMENSION_SLOTS.category),
          observation_id: obsId,
          dimension_value_id: catDvId,
          dimension_type_id: catDtId,
        });
      }

      if (hasNote) {
        await noteWriter.write({
          id: observationNoteId(obsId),
          observation_id: obsId,
          note_type_id: c.ValueNoteId,
        });
      }
    })();
  });

  context.excludedObservations = excludedCount;

  return {
    observation: await obsWriter.close(),
    observation_dimension: await dimWriter.close(),
    observation_note: await noteWriter.close(),
  };
}

// ─── Compound row writer ──────────────────────────────────────────────────────

async function writeCompoundRow(
  c: CdsRow,
  areaId: number,
  fromDate: string,
  toDate: string,
  uploadBId: number,
  value: number | null,
  count: number | null,
  denominator: number | null,
  denominator2: number | null,
  ci95: { lower: number | null; upper: number | null },
  ci998: { lower: number | null; upper: number | null },
  hasNote: boolean,
  obsWriter: TableWriter,
  dimWriter: TableWriter,
  noteWriter: TableWriter,
  enteredAt: string,
  dimensionValueIds: Set<number>,
): Promise<void> {
  const { maleDvId, femaleDvId } = compoundAgeDimensionValueIds(c.AgeID);
  const maleSexDvId = sexDimensionValueId(1);
  const femaleSexDvId = sexDimensionValueId(2);

  dimensionValueIds.add(maleDvId);
  dimensionValueIds.add(femaleDvId);
  dimensionValueIds.add(maleSexDvId);
  dimensionValueIds.add(femaleSexDvId);

  const catDvId =
    c.CategoryTypeID !== -1 && c.CategoryID !== -1
      ? categoryDimensionValueId(c.CategoryTypeID, c.CategoryID)
      : null;
  const catDtId = catDvId !== null ? categoryDimensionTypeId(c.CategoryTypeID) : null;
  if (catDvId !== null) dimensionValueIds.add(catDvId);

  const maleObsId = observationId(c.uid, 0);
  const femaleObsId = observationId(c.uid, 1);

  // Write male (split=0) first — lower id
  await obsWriter.write({
    id: maleObsId,
    indicator_id: c.IndicatorID,
    area_id: areaId,
    from_date: fromDate,
    to_date: toDate,
    value,
    count,
    denominator,
    denominator_2: denominator2,
    lower_ci_95: ci95.lower,
    upper_ci_95: ci95.upper,
    lower_ci_998: ci998.lower,
    upper_ci_998: ci998.upper,
    distribution_rank: null,
    published_at: enteredAt,
    upload_batch_id: uploadBId,
    dimension_key: [maleSexDvId, maleDvId, ...(catDvId === null ? [] : [catDvId])]
      .sort((a, b) => a - b)
      .join(','),
    created_at: enteredAt,
    created_by: 'pholio-migration',
    deleted_at: null,
  });

  await dimWriter.write({
    id: observationDimensionId(maleObsId, DIMENSION_SLOTS.sex),
    observation_id: maleObsId,
    dimension_value_id: maleSexDvId,
    dimension_type_id: SEX_DIMENSION_TYPE_ID,
  });
  await dimWriter.write({
    id: observationDimensionId(maleObsId, DIMENSION_SLOTS.age),
    observation_id: maleObsId,
    dimension_value_id: maleDvId,
    dimension_type_id: AGE_DIMENSION_TYPE_ID,
  });
  if (catDvId !== null && catDtId !== null) {
    await dimWriter.write({
      id: observationDimensionId(maleObsId, DIMENSION_SLOTS.category),
      observation_id: maleObsId,
      dimension_value_id: catDvId,
      dimension_type_id: catDtId,
    });
  }
  if (hasNote) {
    await noteWriter.write({
      id: observationNoteId(maleObsId),
      observation_id: maleObsId,
      note_type_id: c.ValueNoteId,
    });
  }

  // Write female (split=1) second — higher id
  await obsWriter.write({
    id: femaleObsId,
    indicator_id: c.IndicatorID,
    area_id: areaId,
    from_date: fromDate,
    to_date: toDate,
    value,
    count,
    denominator,
    denominator_2: denominator2,
    lower_ci_95: ci95.lower,
    upper_ci_95: ci95.upper,
    lower_ci_998: ci998.lower,
    upper_ci_998: ci998.upper,
    distribution_rank: null,
    published_at: enteredAt,
    upload_batch_id: uploadBId,
    dimension_key: [femaleSexDvId, femaleDvId, ...(catDvId === null ? [] : [catDvId])]
      .sort((a, b) => a - b)
      .join(','),
    created_at: enteredAt,
    created_by: 'pholio-migration',
    deleted_at: null,
  });

  await dimWriter.write({
    id: observationDimensionId(femaleObsId, DIMENSION_SLOTS.sex),
    observation_id: femaleObsId,
    dimension_value_id: femaleSexDvId,
    dimension_type_id: SEX_DIMENSION_TYPE_ID,
  });
  await dimWriter.write({
    id: observationDimensionId(femaleObsId, DIMENSION_SLOTS.age),
    observation_id: femaleObsId,
    dimension_value_id: femaleDvId,
    dimension_type_id: AGE_DIMENSION_TYPE_ID,
  });
  if (catDvId !== null && catDtId !== null) {
    await dimWriter.write({
      id: observationDimensionId(femaleObsId, DIMENSION_SLOTS.category),
      observation_id: femaleObsId,
      dimension_value_id: catDvId,
      dimension_type_id: catDtId,
    });
  }
  if (hasNote) {
    await noteWriter.write({
      id: observationNoteId(femaleObsId),
      observation_id: femaleObsId,
      note_type_id: c.ValueNoteId,
    });
  }
}
