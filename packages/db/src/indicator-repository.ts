import { yearTypeLabel } from '@fphd/utils/period-type';
import type { Polarity } from '@fphd/utils/polarity';
import { isShortId, SHORT_ID_PATTERN } from '@fphd/utils/short-id';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@fphd/utils/slug';
import type { UpdateFrequency } from '@fphd/utils/update-frequency';
import { unitLabel } from '@fphd/utils/value-type-and-unit';
import {
  and,
  asc,
  countDistinct,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  min,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

import type { Database } from './client.ts';
import {
  type IndicatorClassification,
  listClassificationsForIndicator,
  listTopicsForIndicator,
} from './indicator-topic-repository.ts';
import {
  publishedArea as area,
  publishedAreaType as areaType,
  publishedAvailableData as availableData,
  publishedCiMethod as ciMethod,
  publishedClassification as classification,
  publishedComparatorMethod as comparatorMethod,
  publishedDataSource as dataSource,
  publishedDimensionType as dimensionType,
  publishedDimensionValue as dimensionValue,
  publishedIndicator as indicator,
  publishedIndicatorClassification as indicatorClassification,
  publishedIndicatorSlug as indicatorSlug,
  publishedIndicatorTopic as indicatorTopic,
  publishedNoteType as noteType,
  publishedNumeratorDenominatorSource as numeratorDenominatorSource,
  publishedObservation as observation,
  publishedObservationDimension as observationDimension,
  publishedObservationNote as observationNote,
  publishedObservationRange as observationRange,
  publishedTopic as topic,
  publishedUnit as unit,
  publishedValueType as valueType,
  publishedYearType as yearType,
} from './schema/index.ts';

export interface IndicatorSearchFilters {
  query: string;
  topics: string[];
  indicatorTypes: string[];
  riskFactors: string[];
  frameworks: string[];
  populations: string[];
  inequalities: string[];
  displayGroups: string[];
  areaCodes: string[];
  sources: string[];
  valueTypes: string[];
  yearTypes: string[];
  limit: number;
}

export interface IndicatorSearchRow {
  shortId: number;
  slug: string;
  name: string;
  topics: { slug: string; title: string }[];
  classifications: { dimension: string; slug: string; name: string }[];
}

export interface IndicatorSearchResult {
  total: number;
  limit: number;
  indicators: IndicatorSearchRow[];
}

export interface IndicatorFacets {
  topics: { slug: string; title: string }[];
  classifications: { dimension: string; slug: string; name: string }[];
  sources: string[];
  valueTypes: string[];
  yearTypes: string[];
}

export interface PublishedIndicator {
  shortId: number;
  slug: string;
  name: string;
}

/**
 * A query that is a whole number matches that short id exactly; a slug-shaped one matches
 * any slug a published version carries, so an indicator's earlier address finds it too.
 * A slug is never digits only, so a digit run matches a short id or nothing.
 */
function exactIdentifierMatch(db: Database, query: string) {
  if (SHORT_ID_PATTERN.test(query)) {
    return isShortId(query) ? eq(indicator.shortId, Number(query)) : sql<boolean>`false`;
  }

  const slug = query.toLowerCase();

  return SLUG_PATTERN.test(slug) && slug.length <= SLUG_MAX_LENGTH
    ? exists(
        db
          .select({ one: sql`1` })
          .from(indicatorSlug)
          .where(and(eq(indicatorSlug.indicatorId, indicator.id), eq(indicatorSlug.slug, slug))),
      )
    : sql<boolean>`false`;
}

function escapedSearchTerms(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[\\%_]/g, '\\$&'));
}

/** The published indicator surface, ordered by name. */
export async function listPublishedIndicators(db: Database): Promise<PublishedIndicator[]> {
  return db
    .select({ shortId: indicator.shortId, slug: indicator.slug, name: indicator.name })
    .from(indicator)
    .orderBy(asc(indicator.name));
}

/** Case-insensitive indicator lookup by name or exact identifier. */
export async function searchPublishedIndicators(
  db: Database,
  query: string,
  limit: number,
): Promise<PublishedIndicator[]> {
  const terms = escapedSearchTerms(query);
  const identifierMatch = exactIdentifierMatch(db, query.trim());
  return db
    .select({ shortId: indicator.shortId, slug: indicator.slug, name: indicator.name })
    .from(indicator)
    .where(or(identifierMatch, and(...terms.map((term) => ilike(indicator.name, `%${term}%`)))))
    .orderBy(
      sql`case when ${identifierMatch} then 0 when lower(${indicator.name}) = lower(${query}) then 1 when ${indicator.name} ilike ${`${query.replace(/[\\%_]/g, '\\$&')}%`} then 2 else 3 end`,
      sql`position(lower(${query}) in lower(${indicator.name}))`,
      asc(indicator.name),
    )
    .limit(limit);
}

export interface IndicatorSource {
  name: string;
  url: string | null;
}

export interface IndicatorAreaType {
  name: string;
  areaCount: number;
}

export interface IndicatorTopic {
  slug: string;
  title: string;
}

export interface IndicatorDetail {
  shortId: number;
  /** The canonical slug: the one the latest published version carries. */
  slug: string;
  name: string;
  valueType: string;
  /** As the public reads it beside a value; null when the values have no unit. */
  unit: string | null;
  /** As the public reads it, which for a year ending on a specified date names the date. */
  yearType: string | null;
  updateFrequency: UpdateFrequency;
  polarity: Polarity;
  ciMethod: string | null;
  ciConfidenceLevel: string | null;
  comparatorMethod: string | null;
  dataUpdatedAt: string | null;
  definition: string | null;
  rationale: string | null;
  methodology: string | null;
  numeratorDefinition: string | null;
  denominatorDefinition: string | null;
  disclosureControl: string | null;
  caveats: string | null;
  notes: string | null;
  dataSource: IndicatorSource | null;
  numeratorSource: IndicatorSource | null;
  denominatorSource: IndicatorSource | null;
  areaTypes: IndicatorAreaType[];
  topics: IndicatorTopic[];
  classifications: IndicatorClassification[];
}

/** The internal id behind a public short id — the one place the external id resolves. */
export async function resolvePublishedIndicatorId(
  db: Database,
  shortId: number,
): Promise<string | undefined> {
  const [row] = await db
    .select({ id: indicator.id })
    .from(indicator)
    .where(eq(indicator.shortId, shortId))
    .limit(1);
  return row?.id;
}

/**
 * The internal id behind a slug. Any slug a published version carries resolves, so a link
 * made before a rename still lands on the indicator; the caller lower-cases first.
 */
export async function resolveIndicatorIdBySlug(
  db: Database,
  slug: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ id: indicatorSlug.indicatorId })
    .from(indicatorSlug)
    .where(eq(indicatorSlug.slug, slug))
    .limit(1);
  return row?.id;
}

/**
 * Everything the indicator page needs in one round trip. The view is the published
 * surface, so an unpublished indicator is indistinguishable from one that does not exist.
 */
export async function getPublishedIndicatorById(
  db: Database,
  indicatorId: string,
): Promise<IndicatorDetail | undefined> {
  // Subqueries rather than alias(): drizzle's table alias cannot carry a view's columns.
  const numeratorSource = db.select().from(numeratorDenominatorSource).as('numerator_source');
  const denominatorSource = db.select().from(numeratorDenominatorSource).as('denominator_source');

  const [row] = await db
    .select({
      id: indicator.id,
      shortId: indicator.shortId,
      slug: indicator.slug,
      name: indicator.name,
      valueType: valueType.name,
      unitId: unit.id,
      unitName: unit.name,
      unitOther: indicator.unitOther,
      yearTypeId: yearType.id,
      yearTypeName: yearType.name,
      yearEndDay: indicator.yearEndDay,
      yearEndMonth: indicator.yearEndMonth,
      updateFrequency: indicator.updateFrequency,
      polarity: indicator.polarity,
      ciMethod: ciMethod.name,
      ciConfidenceLevel: indicator.ciConfidenceLevel,
      comparatorMethod: comparatorMethod.name,
      dataUpdatedAt: indicator.dataUpdatedAt,
      definition: indicator.definition,
      rationale: indicator.rationale,
      methodology: indicator.methodology,
      numeratorDefinition: indicator.numeratorDefinition,
      denominatorDefinition: indicator.denominatorDefinition,
      disclosureControl: indicator.disclosureControlDetail,
      caveats: indicator.caveatsDetail,
      notes: indicator.otherNotesDetail,
      dataSourceName: dataSource.name,
      dataSourceUrl: dataSource.url,
      numeratorSourceName: numeratorSource.name,
      numeratorSourceUrl: numeratorSource.url,
      denominatorSourceName: denominatorSource.name,
      denominatorSourceUrl: denominatorSource.url,
    })
    .from(indicator)
    .innerJoin(valueType, eq(indicator.valueTypeId, valueType.id))
    .innerJoin(unit, eq(indicator.unitId, unit.id))
    // A months indicator has no year type.
    .leftJoin(yearType, eq(indicator.yearTypeId, yearType.id))
    .leftJoin(ciMethod, eq(indicator.ciMethodId, ciMethod.id))
    .leftJoin(comparatorMethod, eq(indicator.comparatorMethodId, comparatorMethod.id))
    .leftJoin(dataSource, eq(indicator.dataSourceId, dataSource.id))
    .leftJoin(numeratorSource, eq(indicator.numeratorSourceId, numeratorSource.id))
    .leftJoin(denominatorSource, eq(indicator.denominatorSourceId, denominatorSource.id))
    .where(eq(indicator.id, indicatorId))
    .limit(1);

  // Required as the inner-joined lookups are: without them, nothing is shown.
  if (!row || row.polarity === null || row.updateFrequency === null) {
    return undefined;
  }

  const [areaTypes, topics, classifications] = await Promise.all([
    db
      .select({ name: availableData.areaTypeName, areaCount: availableData.areaCount })
      .from(availableData)
      .where(eq(availableData.indicatorId, row.id))
      .orderBy(asc(availableData.areaTypeName)),
    listTopicsForIndicator(db, row.id),
    listClassificationsForIndicator(db, row.id),
  ]);

  return {
    shortId: row.shortId,
    slug: row.slug,
    name: row.name,
    valueType: row.valueType,
    unit: unitLabel({ id: row.unitId, name: row.unitName }, row.unitOther),
    yearType: publicYearTypeLabel({
      id: row.yearTypeId,
      name: row.yearTypeName,
      yearEndDay: row.yearEndDay,
      yearEndMonth: row.yearEndMonth,
    }),
    updateFrequency: row.updateFrequency,
    polarity: row.polarity,
    ciMethod: row.ciMethod,
    ciConfidenceLevel: row.ciConfidenceLevel,
    comparatorMethod: row.comparatorMethod,
    dataUpdatedAt: row.dataUpdatedAt?.toISOString() ?? null,
    definition: row.definition,
    rationale: row.rationale,
    methodology: row.methodology,
    numeratorDefinition: row.numeratorDefinition,
    denominatorDefinition: row.denominatorDefinition,
    disclosureControl: row.disclosureControl,
    caveats: row.caveats,
    notes: row.notes,
    dataSource:
      row.dataSourceName === null ? null : { name: row.dataSourceName, url: row.dataSourceUrl },
    numeratorSource:
      row.numeratorSourceName === null
        ? null
        : { name: row.numeratorSourceName, url: row.numeratorSourceUrl },
    denominatorSource:
      row.denominatorSourceName === null
        ? null
        : { name: row.denominatorSourceName, url: row.denominatorSourceUrl },
    areaTypes,
    topics,
    classifications,
  };
}

export interface ObservationDimensionValue {
  type: string;
  value: string;
  dimensionClass: string;
  sortOrder: number;
}

export interface IndicatorObservation {
  fromDate: string;
  toDate: string;
  value: number | null;
  lowerCi95: number | null;
  upperCi95: number | null;
  lowerCi998: number | null;
  upperCi998: number | null;
  count: number | null;
  denominator: number | null;
  dimensions: ObservationDimensionValue[];
  /** Note texts attached to the value, with their category ("quality", "disclosure"…). */
  notes: { text: string; category: string }[];
}

export interface IndicatorAreaData {
  areaCode: string;
  areaName: string;
  observations: IndicatorObservation[];
}

/**
 * All published observations for one indicator in one area, with their dimension labels.
 * An observation with no dimensions is the fully-aggregate value for its period.
 */
export async function getIndicatorObservations(
  db: Database,
  indicatorId: string,
  areaCode: string,
): Promise<IndicatorAreaData | undefined> {
  const rows = await db
    .select({
      obsId: observation.id,
      fromDate: observation.fromDate,
      toDate: observation.toDate,
      value: observation.value,
      lowerCi95: observation.lowerCi95,
      upperCi95: observation.upperCi95,
      lowerCi998: observation.lowerCi998,
      upperCi998: observation.upperCi998,
      count: observation.count,
      denominator: observation.denominator,
      areaName: area.name,
    })
    .from(observation)
    .innerJoin(area, and(eq(observation.areaId, area.id), eq(area.code, areaCode)))
    .where(eq(observation.indicatorId, indicatorId))
    .orderBy(asc(observation.fromDate), asc(observation.toDate));

  if (rows.length === 0) {
    // The id is already resolved, so an empty result distinguishes only the area.
    const [areaRow] = await db
      .select({ name: area.name })
      .from(area)
      .where(eq(area.code, areaCode))
      .limit(1);

    if (!areaRow) {
      return undefined;
    }

    return { areaCode, areaName: areaRow.name, observations: [] };
  }

  const dimensionRows = await db
    .select({
      observationId: observationDimension.observationId,
      type: dimensionType.name,
      value: dimensionValue.name,
      dimensionClass: dimensionType.dimensionClass,
      sortOrder: dimensionValue.sortOrder,
    })
    .from(observationDimension)
    .innerJoin(dimensionValue, eq(observationDimension.dimensionValueId, dimensionValue.id))
    .innerJoin(dimensionType, eq(observationDimension.dimensionTypeId, dimensionType.id))
    .where(
      inArray(
        observationDimension.observationId,
        rows.map((row) => row.obsId),
      ),
    );

  const dimensionsByObservation = new Map<string, ObservationDimensionValue[]>();
  for (const { observationId, ...dimension } of dimensionRows) {
    const existing = dimensionsByObservation.get(observationId);
    if (existing) {
      existing.push(dimension);
    } else {
      dimensionsByObservation.set(observationId, [dimension]);
    }
  }

  const noteRows = await db
    .select({
      observationId: observationNote.observationId,
      text: noteType.text,
      category: noteType.category,
    })
    .from(observationNote)
    .innerJoin(noteType, eq(observationNote.noteTypeId, noteType.id))
    .where(
      inArray(
        observationNote.observationId,
        rows.map((row) => row.obsId),
      ),
    );
  const notesByObservation = new Map<string, { text: string; category: string }[]>();
  for (const { observationId, ...note } of noteRows) {
    const existing = notesByObservation.get(observationId);
    if (existing) {
      existing.push(note);
    } else {
      notesByObservation.set(observationId, [note]);
    }
  }

  return {
    areaCode,
    areaName: rows[0]?.areaName ?? areaCode,
    observations: rows.map(({ obsId, areaName: _areaName, ...observationRow }) => ({
      ...observationRow,
      dimensions: (dimensionsByObservation.get(obsId) ?? []).sort((a, b) =>
        a.type.localeCompare(b.type),
      ),
      notes: notesByObservation.get(obsId) ?? [],
    })),
  };
}

export interface ObservationRangePeriod {
  fromDate: string;
  toDate: string;
  /** The segment's dimension values joined by '|' in dimension-type order, '' for the
   *  fully-aggregate series — the same shape a client derives from an observation. */
  segment: string;
  min: number;
  max: number;
}

/** The precomputed per-period range for each least-disaggregated segment at a display level. */
export async function getObservationRange(
  db: Database,
  indicatorId: string,
  displayGroup: string,
): Promise<ObservationRangePeriod[]> {
  return db
    .select({
      fromDate: observationRange.fromDate,
      toDate: observationRange.toDate,
      segment: observationRange.segment,
      min: observationRange.min,
      max: observationRange.max,
    })
    .from(observationRange)
    .where(
      and(
        eq(observationRange.indicatorId, indicatorId),
        eq(observationRange.displayGroup, displayGroup),
      ),
    )
    .orderBy(asc(observationRange.fromDate), asc(observationRange.toDate));
}

export async function searchIndicators(
  db: Database,
  filters: IndicatorSearchFilters,
): Promise<IndicatorSearchResult> {
  const classificationExists = (dimension: string, slugs: string[]) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(indicatorClassification)
        .innerJoin(
          classification,
          and(
            eq(indicatorClassification.classificationId, classification.id),
            eq(classification.dimension, dimension),
            inArray(classification.slug, slugs),
          ),
        )
        .where(eq(indicatorClassification.indicatorId, indicator.id)),
    );

  // The view is the published surface, so a search starts unfiltered.
  const conditions: SQL[] = [];

  const query = filters.query.trim();
  const identifierMatch = exactIdentifierMatch(db, query);
  const topicQueryMatch = (term: string) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(indicatorTopic)
        .innerJoin(topic, eq(indicatorTopic.topicId, topic.id))
        .where(
          and(
            eq(indicatorTopic.indicatorId, indicator.id),
            or(ilike(topic.title, `%${term}%`), ilike(topic.slug, `%${term}%`)),
          ),
        ),
    );
  const classificationQueryMatch = (term: string) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(indicatorClassification)
        .innerJoin(classification, eq(indicatorClassification.classificationId, classification.id))
        .where(
          and(
            eq(indicatorClassification.indicatorId, indicator.id),
            or(ilike(classification.name, `%${term}%`), ilike(classification.slug, `%${term}%`)),
          ),
        ),
    );

  if (query) {
    const termMatches = escapedSearchTerms(query).map(
      (term) =>
        or(
          ilike(indicator.name, `%${term}%`),
          topicQueryMatch(term),
          classificationQueryMatch(term),
        ) ?? sql<boolean>`false`,
    );
    conditions.push(or(identifierMatch, and(...termMatches)) ?? sql<boolean>`false`);
  }

  if (filters.topics.length > 0) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(indicatorTopic)
          .innerJoin(
            topic,
            and(eq(indicatorTopic.topicId, topic.id), inArray(topic.slug, filters.topics)),
          )
          .where(eq(indicatorTopic.indicatorId, indicator.id)),
      ),
    );
  }

  if (filters.indicatorTypes.length > 0) {
    conditions.push(classificationExists('indicator_type', filters.indicatorTypes));
  }
  if (filters.riskFactors.length > 0) {
    conditions.push(classificationExists('risk_factor', filters.riskFactors));
  }
  if (filters.frameworks.length > 0) {
    conditions.push(classificationExists('framework', filters.frameworks));
  }
  if (filters.populations.length > 0) {
    conditions.push(classificationExists('population', filters.populations));
  }
  if (filters.inequalities.length > 0) {
    conditions.push(classificationExists('inequality', filters.inequalities));
  }

  if (filters.displayGroups.length > 0) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(availableData)
          .innerJoin(
            areaType,
            and(
              eq(availableData.areaTypeId, areaType.id),
              inArray(areaType.displayGroup, filters.displayGroups),
            ),
          )
          .where(eq(availableData.indicatorId, indicator.id)),
      ),
    );
  }

  if (filters.areaCodes.length > 0) {
    conditions.push(
      inArray(
        indicator.id,
        db
          .select({ id: observation.indicatorId })
          .from(observation)
          .innerJoin(area, eq(observation.areaId, area.id))
          .where(and(inArray(area.code, filters.areaCodes), isNotNull(observation.value)))
          .groupBy(observation.indicatorId)
          .having(eq(countDistinct(area.code), filters.areaCodes.length)),
      ),
    );
  }

  if (filters.sources.length > 0) {
    conditions.push(
      inArray(
        indicator.dataSourceId,
        db
          .select({ id: dataSource.id })
          .from(dataSource)
          .where(inArray(dataSource.name, filters.sources)),
      ),
    );
  }

  if (filters.valueTypes.length > 0) {
    conditions.push(
      inArray(
        indicator.valueTypeId,
        db
          .select({ id: valueType.id })
          .from(valueType)
          .where(inArray(valueType.name, filters.valueTypes)),
      ),
    );
  }

  if (filters.yearTypes.length > 0) {
    const chosen = (await listPublishedYearTypes(db)).filter(({ label }) =>
      filters.yearTypes.includes(label),
    );
    conditions.push(
      or(
        ...chosen.map(({ id, yearEndDay, yearEndMonth }) =>
          and(
            eq(indicator.yearTypeId, id),
            sql`${indicator.yearEndDay} IS NOT DISTINCT FROM ${yearEndDay}`,
            sql`${indicator.yearEndMonth} IS NOT DISTINCT FROM ${yearEndMonth}`,
          ),
        ),
      ) ?? sql<boolean>`false`,
    );
  }

  const where = and(...conditions);

  const firstTopicTitle = db
    .select({ t: min(topic.title) })
    .from(indicatorTopic)
    .innerJoin(topic, eq(indicatorTopic.topicId, topic.id))
    .where(eq(indicatorTopic.indicatorId, indicator.id));

  const escapedQuery = query.replace(/[\\%_]/g, '\\$&');
  const relevance = sql`case when ${identifierMatch} then 0 when lower(${indicator.name}) = lower(${query}) then 1 when ${indicator.name} ilike ${`${escapedQuery}%`} then 2 when ${indicator.name} ilike ${`%${escapedQuery}%`} then 3 else 4 end`;
  const [countResult, rows] = await Promise.all([
    db
      .select({ total: countDistinct(indicator.id) })
      .from(indicator)
      .where(where),
    db
      .select({
        id: indicator.id,
        shortId: indicator.shortId,
        slug: indicator.slug,
        name: indicator.name,
      })
      .from(indicator)
      .where(where)
      .orderBy(
        ...(query
          ? [
              relevance,
              sql`position(lower(${query}) in lower(${indicator.name}))`,
              asc(indicator.name),
            ]
          : [sql`(${firstTopicTitle}) nulls last`, asc(indicator.name)]),
      )
      .limit(filters.limit),
  ]);

  const total = countResult[0]?.total ?? 0;

  if (rows.length === 0) {
    return { total, limit: filters.limit, indicators: [] };
  }

  const ids = rows.map((r) => r.id);

  const [topicRows, classificationRows] = await Promise.all([
    db
      .select({
        indicatorId: indicatorTopic.indicatorId,
        slug: topic.slug,
        title: topic.title,
      })
      .from(indicatorTopic)
      .innerJoin(topic, eq(indicatorTopic.topicId, topic.id))
      .where(inArray(indicatorTopic.indicatorId, ids))
      .orderBy(asc(topic.title)),
    db
      .select({
        indicatorId: indicatorClassification.indicatorId,
        dimension: classification.dimension,
        slug: classification.slug,
        name: classification.name,
      })
      .from(indicatorClassification)
      .innerJoin(classification, eq(indicatorClassification.classificationId, classification.id))
      .where(inArray(indicatorClassification.indicatorId, ids))
      .orderBy(asc(classification.dimension), asc(classification.name)),
  ]);

  const topicsByIndicator = new Map<string, { slug: string; title: string }[]>();
  for (const { indicatorId, slug, title } of topicRows) {
    const existing = topicsByIndicator.get(indicatorId);
    if (existing) {
      existing.push({ slug, title });
    } else {
      topicsByIndicator.set(indicatorId, [{ slug, title }]);
    }
  }

  const classificationsByIndicator = new Map<
    string,
    { dimension: string; slug: string; name: string }[]
  >();
  for (const { indicatorId, dimension, slug, name } of classificationRows) {
    const existing = classificationsByIndicator.get(indicatorId);
    if (existing) {
      existing.push({ dimension, slug, name });
    } else {
      classificationsByIndicator.set(indicatorId, [{ dimension, slug, name }]);
    }
  }

  return {
    total,
    limit: filters.limit,
    indicators: rows.map((r) => ({
      shortId: r.shortId,
      slug: r.slug,
      name: r.name,
      topics: topicsByIndicator.get(r.id) ?? [],
      classifications: classificationsByIndicator.get(r.id) ?? [],
    })),
  };
}

/** A version's year type and year end; the year type is null for months. */
interface YearTypeColumns {
  id: string | null;
  name: string | null;
  yearEndDay: number | null;
  yearEndMonth: number | null;
}

function publicYearTypeLabel({ id, name, yearEndDay, yearEndMonth }: YearTypeColumns) {
  if (id === null || name === null) return null;
  const yearEnd =
    yearEndDay === null || yearEndMonth === null ? null : { day: yearEndDay, month: yearEndMonth };
  return yearTypeLabel({ id, name }, yearEnd);
}

/**
 * Each year type and year end a published indicator has, with the label the public reads it
 * by; the search filter chooses by label, and one label may stand for several of these.
 */
async function listPublishedYearTypes(
  db: Database,
): Promise<(YearTypeColumns & { id: string; label: string })[]> {
  const rows = await db
    .selectDistinct({
      id: yearType.id,
      name: yearType.name,
      yearEndDay: indicator.yearEndDay,
      yearEndMonth: indicator.yearEndMonth,
    })
    .from(indicator)
    .innerJoin(yearType, eq(indicator.yearTypeId, yearType.id));

  return rows.map((row) => ({ ...row, label: publicYearTypeLabel(row) ?? row.name }));
}

export async function listIndicatorFacets(db: Database): Promise<IndicatorFacets> {
  const publishedIds = db.select({ id: indicator.id }).from(indicator);

  const [topics, classifications, sources, valueTypes, yearTypes] = await Promise.all([
    db
      .selectDistinct({ slug: topic.slug, title: topic.title })
      .from(topic)
      .innerJoin(indicatorTopic, eq(indicatorTopic.topicId, topic.id))
      .where(inArray(indicatorTopic.indicatorId, publishedIds))
      .orderBy(asc(topic.title)),
    db
      .selectDistinct({
        dimension: classification.dimension,
        slug: classification.slug,
        name: classification.name,
      })
      .from(classification)
      .innerJoin(
        indicatorClassification,
        eq(indicatorClassification.classificationId, classification.id),
      )
      .where(inArray(indicatorClassification.indicatorId, publishedIds))
      .orderBy(asc(classification.dimension), asc(classification.name)),
    db
      .selectDistinct({ name: dataSource.name })
      .from(dataSource)
      .innerJoin(indicator, eq(indicator.dataSourceId, dataSource.id))
      .orderBy(asc(dataSource.name)),
    db
      .selectDistinct({ name: valueType.name })
      .from(valueType)
      .innerJoin(indicator, eq(indicator.valueTypeId, valueType.id))
      .orderBy(asc(valueType.name)),
    listPublishedYearTypes(db),
  ]);

  return {
    topics,
    classifications,
    sources: sources.map((s) => s.name),
    valueTypes: valueTypes.map((v) => v.name),
    yearTypes: [...new Set(yearTypes.map(({ label }) => label))].sort((a, b) => a.localeCompare(b)),
  };
}
