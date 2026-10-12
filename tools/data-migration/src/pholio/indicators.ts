import { translateFrequency, translatePolarity } from '../fingertips-lookups.ts';
import { notesAndCaveats } from '../notes-and-caveats.ts';
import type { PholioExportContext, StageResult } from './context.ts';
import { uploadBatchId } from './ids.ts';
import type { PholioRow } from './source.ts';
import { queryPholio } from './source.ts';
import { TableWriter } from './table-writer.ts';
import { unitValues, unknownUnits, unknownValueTypes, valueTypeId } from './value-type-and-unit.ts';
import { YEAR_TYPES, yearTypeValues } from './year-type.ts';

// The 16 indicator ids whose polarity must be forced to BOB regardless of Pholio grouping data.
const BOB_OVERRIDE_IDS = new Set([
  212, 219, 241, 247, 258, 262, 273, 280, 352, 848, 1179, 1180, 90443, 90581, 91269, 93777,
]);

// The Pholio polarity id that maps to BOB.
const BOB_POLARITY_ID = 99;
// Fallback polarity_id when no grouping row selects one.
const DEFAULT_POLARITY_ID = 1;

/**
 * Reproduced from the T-SQL dbo.StripHTML function (migrate-pholio-to-fphd.sql lines 1061–1087).
 * Converts common semantic tags to markdown equivalents, then strips any remaining HTML tags
 * iteratively. Unclosed tags (no matching >) are left in place — the T-SQL BREAK on missing
 * end-angle does the same.
 */
export function stripHtml(html: string): string {
  let text = html;
  // Ordered replacements matching the T-SQL exactly.
  text = text.replaceAll('<br>', '\n').replaceAll('<br/>', '\n').replaceAll('<br />', '\n');
  text = text.replaceAll('<p>', '\n').replaceAll('</p>', '');
  text = text.replaceAll('<li>', '\n- ').replaceAll('</li>', '');
  text = text.replaceAll('<b>', '**').replaceAll('</b>', '**');
  text = text.replaceAll('<strong>', '**').replaceAll('</strong>', '**');
  text = text.replaceAll('<em>', '*').replaceAll('</em>', '*');
  text = text.replaceAll('<i>', '*').replaceAll('</i>', '*');
  // Iteratively strip remaining tags. CHARINDEX finds the next '<', then CHARINDEX('>', ...) from
  // that position finds the closing '>'. If no '>' found, the T-SQL breaks — we do the same.
  let start = text.indexOf('<');
  while (start !== -1) {
    const end = text.indexOf('>', start);
    if (end === -1) break;
    text = text.slice(0, start) + text.slice(end + 1);
    start = text.indexOf('<');
  }
  return text;
}

/**
 * Whether the T-SQL UPDATE applies StripHTML to this row. The WHERE clause checks each
 * prose column with LIKE '%<%>%' — i.e. contains a '<' followed anywhere by a '>'.
 */
function rowNeedsStrip(columns: Array<string | null>): boolean {
  return columns.some((v) => v?.includes('<') && v.includes('>'));
}

/** Apply stripHtml to the prose if the row triggers the LIKE condition, else pass through. */
function maybeStrip(value: string | null, rowTriggered: boolean): string | null {
  if (value === null) return null;
  return rowTriggered ? stripHtml(value) : value;
}

interface PolarityRow extends PholioRow {
  IndicatorID: number;
  PolarityID: number;
}

interface ComparatorRow extends PholioRow {
  IndicatorID: number;
  ComparatorMethodID: number;
}

interface CiLevelRow extends PholioRow {
  IndicatorID: number;
  ci_confidence_level: string;
}

interface IndicatorMetaRow extends PholioRow {
  IndicatorID: number;
  Name: string | null;
  ValueTypeName: string | null;
  UnitName: string | null;
  YearTypeName: string | null;
  CIMethodID: number | null;
  EnteredAt: Date;
}

interface TextValuesRow extends PholioRow {
  IndicatorID: number;
  Definition: string | null;
  Rationale: string | null;
  Methodology: string | null;
  NumeratorDefinition: string | null;
  DenominatorDefinition: string | null;
  DataSourceID: number | null;
  NumeratorSourceID: number | null;
  DenominatorSourceID: number | null;
  DisclosureControl: string | null;
  Caveats: string | null;
  Notes: string | null;
}

/** Exports indicator, indicator_version and upload_batch from Pholio. */
export async function exportIndicators(context: PholioExportContext): Promise<StageResult> {
  const { pool, outDir, excludedIndicators } = context;

  const excluded = new Set(excludedIndicators);
  // Always exclude the one test indicator the alpha migration hard-coded.
  excluded.add(94204);

  // Pre-compute polarity per indicator: first non-default polarity row by GroupingID,
  // then apply the 16 BOB overrides.
  const polarityRows = await queryPholio<PolarityRow>(
    pool,
    `SELECT IndicatorID, PolarityID
     FROM (
       SELECT IndicatorID, PolarityID,
         ROW_NUMBER() OVER (PARTITION BY IndicatorID ORDER BY
           CASE WHEN PolarityID NOT IN (0, -1) THEN 0 ELSE 1 END, GroupingID) AS rn
       FROM dbo.[grouping]
       WHERE PolarityID != -1
     ) g
     WHERE rn = 1`,
  );
  const polarityById = new Map<number, number>();
  for (const row of polarityRows) {
    const pid = BOB_OVERRIDE_IDS.has(row.IndicatorID) ? BOB_POLARITY_ID : row.PolarityID;
    polarityById.set(row.IndicatorID, pid);
  }
  // Indicators in the BOB override list that have no grouping rows still need BOB.
  for (const id of BOB_OVERRIDE_IDS) {
    if (!polarityById.has(id)) polarityById.set(id, BOB_POLARITY_ID);
  }

  // Pre-compute polarity name lookup from Pholio polarity table.
  const polarityNames = await queryPholio<{ id: number; name: string }>(
    pool,
    'SELECT PolarityID AS id, Polarity AS name FROM dbo.L_Polarity',
  );
  const polarityNameById = new Map<number, string>();
  for (const row of polarityNames) polarityNameById.set(row.id, row.name);

  // Pre-compute frequency name for id=1 (the only value used). Column is Name.
  const freqRows = await queryPholio<{ id: number; name: string }>(
    pool,
    'SELECT FrequencyID AS id, Name AS name FROM dbo.CIA_L_Frequency WHERE FrequencyID = 1',
  );
  const annualFrequencyName = freqRows[0]?.name ?? 'Annual';

  // Pre-compute comparator method per indicator: most common ComparatorMethodID in grouping.
  const comparatorRows = await queryPholio<ComparatorRow>(
    pool,
    `SELECT IndicatorID, ComparatorMethodID
     FROM (
       SELECT IndicatorID, ComparatorMethodID,
         ROW_NUMBER() OVER (
           PARTITION BY IndicatorID
           ORDER BY COUNT(*) DESC, MIN(GroupingID)
         ) AS rn
       FROM dbo.[grouping]
       WHERE ComparatorMethodID IS NOT NULL
         AND ComparatorMethodID != -1
         AND ComparatorMethodID IN (
           SELECT ComparatorMethodID FROM dbo.L_ComparatorMethods
           UNION
           SELECT DISTINCT g2.ComparatorMethodID
           FROM dbo.[grouping] g2
           WHERE g2.ComparatorMethodID IS NOT NULL AND g2.ComparatorMethodID != -1
         )
       GROUP BY IndicatorID, ComparatorMethodID
     ) g
     WHERE rn = 1`,
  );
  const comparatorById = new Map<number, number>();
  for (const row of comparatorRows) comparatorById.set(row.IndicatorID, row.ComparatorMethodID);

  // Pre-compute CI confidence level per indicator from CoreDataSet.
  const ciLevelRows = await queryPholio<CiLevelRow>(
    pool,
    `SELECT IndicatorID,
       CASE
         WHEN MAX(CASE WHEN LowerCI95 != -1 OR UpperCI95 != -1 THEN 1 ELSE 0 END) = 1
          AND MAX(CASE WHEN LowerCI99_8 != -1 OR UpperCI99_8 != -1 THEN 1 ELSE 0 END) = 1 THEN 'both'
         WHEN MAX(CASE WHEN LowerCI99_8 != -1 OR UpperCI99_8 != -1 THEN 1 ELSE 0 END) = 1 THEN '99.8'
         WHEN MAX(CASE WHEN LowerCI95 != -1 OR UpperCI95 != -1 THEN 1 ELSE 0 END) = 1 THEN '95'
         ELSE NULL
       END AS ci_confidence_level
     FROM dbo.CoreDataSet
     GROUP BY IndicatorID
     HAVING MAX(CASE WHEN LowerCI95 != -1 OR UpperCI95 != -1 THEN 1 ELSE 0 END) = 1
         OR MAX(CASE WHEN LowerCI99_8 != -1 OR UpperCI99_8 != -1 THEN 1 ELSE 0 END) = 1`,
  );
  const ciLevelById = new Map<number, string>();
  for (const row of ciLevelRows) {
    if (row.ci_confidence_level) ciLevelById.set(row.IndicatorID, row.ci_confidence_level);
  }

  // Pre-flight: verify all value types, units and year types are translatable before opening writers.
  const allValueTypeNames = await queryPholio<{ ValueType: string }>(
    pool,
    `SELECT DISTINCT vt.ValueType
     FROM dbo.L_ValueTypes vt
     WHERE EXISTS (
       SELECT 1 FROM dbo.IndicatorMetadata im WHERE im.ValueTypeID = vt.ValueTypeID
     )
     UNION
     SELECT DISTINCT CONCAT('Unknown value type ', im.ValueTypeID) AS ValueType
     FROM dbo.IndicatorMetadata im
     WHERE im.ValueTypeID IS NOT NULL AND im.ValueTypeID != -1
       AND NOT EXISTS (SELECT 1 FROM dbo.L_ValueTypes vt WHERE vt.ValueTypeID = im.ValueTypeID)`,
  );
  const unmappableValueTypes = unknownValueTypes(allValueTypeNames.map((r) => r.ValueType));
  if (unmappableValueTypes.length > 0) {
    throw new Error(`Cannot translate value types: ${unmappableValueTypes.join(', ')}`);
  }

  const allUnitNames = await queryPholio<{ Unit: string }>(
    pool,
    `SELECT DISTINCT u.Unit
     FROM dbo.L_Units u
     WHERE EXISTS (
       SELECT 1 FROM dbo.IndicatorMetadata im WHERE im.UnitID = u.UnitID
     )
     UNION
     SELECT DISTINCT CONCAT('Unknown unit ', im.UnitID) AS Unit
     FROM dbo.IndicatorMetadata im
     WHERE im.UnitID IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.L_Units u WHERE u.UnitID = im.UnitID)`,
  );
  const unmappableUnits = unknownUnits(allUnitNames.map((r) => r.Unit));
  if (unmappableUnits.length > 0) {
    throw new Error(`Cannot translate units: ${unmappableUnits.join(', ')}`);
  }

  const allYearTypeNames = await queryPholio<{ YearType: string }>(
    pool,
    `SELECT DISTINCT yt.YearType
     FROM dbo.L_YearTypes yt
     WHERE EXISTS (
       SELECT 1 FROM dbo.IndicatorMetadata im WHERE im.YearTypeID = yt.YearTypeID
     )`,
  );
  const unmappableYearTypes = allYearTypeNames
    .map((r) => r.YearType)
    .filter((name) => !(name in YEAR_TYPES));
  if (unmappableYearTypes.length > 0) {
    throw new Error(`Cannot translate year types: ${unmappableYearTypes.join(', ')}`);
  }

  // Load indicator metadata base columns.
  const metaRows = await queryPholio<IndicatorMetaRow>(
    pool,
    `SELECT
       im.IndicatorID,
       imtv.[1_Name] AS Name,
       ISNULL(vt.ValueType, CONCAT('Unknown value type ', im.ValueTypeID)) AS ValueTypeName,
       ISNULL(u.Unit, CONCAT('Unknown unit ', im.UnitID)) AS UnitName,
       yt.YearType AS YearTypeName,
       im.CIMethodID,
       im.DateEnteredInPHOLIO AS EnteredAt
     FROM dbo.IndicatorMetadata im
     LEFT JOIN dbo.IndicatorMetadataTextValues imtv
       ON im.IndicatorID = imtv.IndicatorID AND imtv.ProfileId IS NULL
     LEFT JOIN dbo.L_ValueTypes vt ON vt.ValueTypeID = im.ValueTypeID
     LEFT JOIN dbo.L_Units u ON u.UnitID = im.UnitID
     LEFT JOIN dbo.L_YearTypes yt ON yt.YearTypeID = im.YearTypeID
     WHERE im.IndicatorID != 94204`,
  );

  // Load prose text values for indicator_metadata (ProfileId IS NULL rows).
  const textRows = await queryPholio<TextValuesRow>(
    pool,
    `SELECT
       imtv.IndicatorID,
       CAST(imtv.[3_Definition] AS nvarchar(max)) AS Definition,
       CAST(imtv.[4_Rationale] AS nvarchar(max)) AS Rationale,
       CAST(imtv.[9_IndMethod] AS nvarchar(max)) AS Methodology,
       CAST(imtv.[13_CountDefinition] AS nvarchar(max)) AS NumeratorDefinition,
       CAST(imtv.[15_DenomDefinition] AS nvarchar(max)) AS DenominatorDefinition,
       imtv.[41_DataSourceID] AS DataSourceID,
       imtv.[42_CountSourceID] AS NumeratorSourceID,
       imtv.[43_DenomSourceID] AS DenominatorSourceID,
       CAST(imtv.[16_DiscControl] AS nvarchar(max)) AS DisclosureControl,
       CAST(imtv.[17_Caveats] AS nvarchar(max)) AS Caveats,
       CAST(imtv.[22_Notes] AS nvarchar(max)) AS Notes
     FROM dbo.IndicatorMetadataTextValues imtv
     WHERE imtv.ProfileId IS NULL`,
  );
  const textById = new Map<number, TextValuesRow>();
  for (const row of textRows) textById.set(row.IndicatorID, row);

  const indicatorWriter = new TableWriter(outDir, 'indicator');
  const versionWriter = new TableWriter(outDir, 'indicator_version');
  const batchWriter = new TableWriter(outDir, 'upload_batch');

  // Sort by IndicatorID ascending so TableWriter id-order check passes.
  metaRows.sort((a, b) => a.IndicatorID - b.IndicatorID);

  for (const row of metaRows) {
    const id = row.IndicatorID;
    if (excluded.has(id)) continue;

    const name = row.Name ?? `Indicator ${id}`;
    const polarityId = polarityById.get(id) ?? DEFAULT_POLARITY_ID;
    const polarityName = polarityNameById.get(polarityId);
    if (polarityName === undefined) {
      throw new Error(`Indicator ${id}: no polarity name for polarity_id ${polarityId}`);
    }
    const polarity = translatePolarity(polarityName);
    const updateFrequency = translateFrequency(annualFrequencyName);

    const vtName = row.ValueTypeName ?? 'Count';
    const resolvedValueTypeId = valueTypeId(vtName);
    const unitName = row.UnitName ?? 'No unit';
    const { unit_id: resolvedUnitId, unit_detail: resolvedUnitDetail } = unitValues(unitName);
    const yearTypeName = row.YearTypeName;
    const yearTypeEntry = yearTypeName ? yearTypeValues(yearTypeName) : null;
    const ciLevel = ciLevelById.get(id) ?? null;
    const comparatorMethodId = comparatorById.get(id) ?? null;

    const text = textById.get(id) ?? null;
    const proseColumns = text
      ? [
          text.Definition,
          text.Rationale,
          text.Methodology,
          text.NumeratorDefinition,
          text.DenominatorDefinition,
        ]
      : [];
    const needsStrip = rowNeedsStrip(proseColumns);

    const definition = text ? maybeStrip(text.Definition, needsStrip) : null;
    const rationale = text ? maybeStrip(text.Rationale, needsStrip) : null;
    const methodology = text ? maybeStrip(text.Methodology, needsStrip) : null;
    const numeratorDefinition = text ? maybeStrip(text.NumeratorDefinition, needsStrip) : null;
    const denominatorDefinition = text ? maybeStrip(text.DenominatorDefinition, needsStrip) : null;
    const dataSourceId = text?.DataSourceID ?? null;
    const numeratorSourceId = text?.NumeratorSourceID ?? null;
    const denominatorSourceId = text?.DenominatorSourceID ?? null;
    const nc = notesAndCaveats({
      disclosureControl: text?.DisclosureControl ?? null,
      caveats: text?.Caveats ?? null,
      notes: text?.Notes ?? null,
    });

    const enteredAt = row.EnteredAt.toISOString();
    await indicatorWriter.write({ id, created_at: enteredAt, data_updated_at: null });

    await versionWriter.write({
      id,
      indicator_id: id,
      status: 'published',
      published_at: enteredAt,
      scheduled_publish_at: null,
      upload_batch_id: uploadBatchId(id),
      data_table_confirmed_at: enteredAt,
      name,
      slug: null,
      value_type_id: resolvedValueTypeId,
      standard_population: null,
      standard_population_detail: null,
      unit_id: resolvedUnitId,
      unit_detail: resolvedUnitDetail,
      sexes: null,
      age_type: null,
      specific_age: null,
      specific_age_unit: null,
      age_detail: null,
      period_type: yearTypeEntry?.period_type ?? null,
      year_type: yearTypeEntry?.year_type ?? null,
      year_end_day: yearTypeEntry?.year_end_day ?? null,
      year_end_month: yearTypeEntry?.year_end_month ?? null,
      polarity,
      has_data_quality_issues: null,
      definition,
      rationale,
      numerator_definition: numeratorDefinition,
      denominator_definition: denominatorDefinition,
      data_source_id: dataSourceId,
      methodology,
      calculated_by: null,
      calculated_by_detail: null,
      ci_method_id: row.CIMethodID ?? null,
      has_ci_method_modifications: null,
      ci_method_modifications_detail: null,
      ci_method_detail: null,
      ci_confidence_level: ciLevel,
      comparator_method_id: comparatorMethodId,
      has_goal_benchmark: null,
      goal_lower_value: null,
      goal_upper_value: null,
      goal_polarity: null,
      goal_policy_detail: null,
      disclosure_control: nc.disclosure_control,
      disclosure_control_detail: nc.disclosure_control_detail,
      has_rounding: nc.has_rounding,
      rounding_detail: nc.rounding_detail,
      has_caveats: nc.has_caveats,
      caveats_detail: nc.caveats_detail,
      has_other_notes: nc.has_other_notes,
      other_notes_detail: nc.other_notes_detail,
      has_links: null,
      has_risk_factor: null,
      has_framework: null,
      has_custom_copyright: null,
      custom_copyright_detail: null,
      has_custom_data_reuse: null,
      custom_data_reuse_detail: null,
      update_frequency: updateFrequency,
      variation: null,
      quality_assurance: null,
      has_source_data_issues: null,
      source_data_issues_detail: null,
      ci_method_justification: null,
      data_sources_justification: null,
      inequalities_included: null,
      has_exclusions: null,
      exclusions_detail: null,
      has_automation: null,
      automation_detail: null,
      sponsors_and_stakeholders: null,
      has_reviewer_comments: null,
      reviewer_comments_detail: null,
      created_at: enteredAt,
      updated_at: enteredAt,
      created_by: 'pholio-migration',
      updated_by: 'pholio-migration',
      numerator_source_id: numeratorSourceId,
      denominator_source_id: denominatorSourceId,
    });

    const batchId = uploadBatchId(id);
    await batchWriter.write({
      id: batchId,
      indicator_id: id,
      indicator_version_id: id,
      original_filename: 'pholio-migration',
      uploaded_by: 'pholio-migration',
      uploaded_at: enteredAt,
      status: 'processed',
      validation_result: null,
      superseded_by_id: null,
    });

    context.indicatorIds.add(id);
    context.indicatorEnteredAt.set(id, enteredAt);
    context.indicatorNames.set(id, name);
  }

  return {
    indicator: await indicatorWriter.close(),
    indicator_version: await versionWriter.close(),
    upload_batch: await batchWriter.close(),
  };
}
