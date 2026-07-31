import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Database } from './client.js';
import {
  area,
  availableData,
  ciMethod,
  comparatorMethod,
  dataSource,
  dimensionType,
  dimensionValue,
  frequency,
  indicator,
  indicatorMetadata,
  numeratorDenominatorSource,
  observation,
  observationDimension,
  polarity,
  unit,
  valueType,
  yearType,
} from './schema/index.js';
import {
  type IndicatorClassification,
  listClassificationsForIndicator,
  listTopicsForIndicator,
} from './topic-indicator-repository.js';

export interface ApprovedIndicator {
  id: string;
  fingertipsId: number;
  name: string;
  status: string;
}

/** The published indicator surface: approved rows only, ordered by name. */
export async function listApprovedIndicators(db: Database): Promise<ApprovedIndicator[]> {
  return db
    .select({
      id: indicator.id,
      fingertipsId: indicator.fingertipsId,
      name: indicator.name,
      status: indicator.status,
    })
    .from(indicator)
    .where(eq(indicator.status, 'approved'))
    .orderBy(asc(indicator.name));
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
  fingertipsId: number;
  name: string;
  valueType: string;
  unit: { name: string; label: string };
  yearType: string;
  frequency: string;
  polarity: string;
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

/**
 * Everything the indicator page needs in one round trip, keyed by the public Fingertips
 * number rather than the internal row id. Approved indicators only — an unpublished
 * indicator is indistinguishable from one that does not exist.
 */
export async function getApprovedIndicatorByFingertipsId(
  db: Database,
  fingertipsId: number,
): Promise<IndicatorDetail | undefined> {
  const numeratorSource = alias(numeratorDenominatorSource, 'numerator_source');
  const denominatorSource = alias(numeratorDenominatorSource, 'denominator_source');

  const [row] = await db
    .select({
      id: indicator.id,
      fingertipsId: indicator.fingertipsId,
      name: indicator.name,
      valueType: valueType.name,
      unitName: unit.name,
      unitLabel: unit.label,
      yearType: yearType.name,
      frequency: frequency.name,
      polarity: polarity.name,
      ciMethod: ciMethod.name,
      ciConfidenceLevel: indicator.ciConfidenceLevel,
      comparatorMethod: comparatorMethod.name,
      dataUpdatedAt: indicator.dataUpdatedAt,
      definition: indicatorMetadata.definition,
      rationale: indicatorMetadata.rationale,
      methodology: indicatorMetadata.methodology,
      numeratorDefinition: indicatorMetadata.numeratorDefinition,
      denominatorDefinition: indicatorMetadata.denominatorDefinition,
      disclosureControl: indicatorMetadata.disclosureControl,
      caveats: indicatorMetadata.caveats,
      notes: indicatorMetadata.notes,
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
    .innerJoin(yearType, eq(indicator.yearTypeId, yearType.id))
    .innerJoin(polarity, eq(indicator.polarityId, polarity.id))
    .innerJoin(frequency, eq(indicator.frequencyId, frequency.id))
    .leftJoin(ciMethod, eq(indicator.ciMethodId, ciMethod.id))
    .leftJoin(comparatorMethod, eq(indicator.comparatorMethodId, comparatorMethod.id))
    .leftJoin(indicatorMetadata, eq(indicatorMetadata.indicatorId, indicator.id))
    .leftJoin(dataSource, eq(indicatorMetadata.dataSourceId, dataSource.id))
    .leftJoin(numeratorSource, eq(indicatorMetadata.numeratorSourceId, numeratorSource.id))
    .leftJoin(denominatorSource, eq(indicatorMetadata.denominatorSourceId, denominatorSource.id))
    .where(and(eq(indicator.fingertipsId, fingertipsId), eq(indicator.status, 'approved')))
    .limit(1);

  if (!row) {
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
    fingertipsId: row.fingertipsId,
    name: row.name,
    valueType: row.valueType,
    unit: { name: row.unitName, label: row.unitLabel },
    yearType: row.yearType,
    frequency: row.frequency,
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
  fingertipsId: number,
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
    .innerJoin(
      indicator,
      and(
        eq(observation.indicatorId, indicator.id),
        eq(indicator.fingertipsId, fingertipsId),
        eq(indicator.status, 'approved'),
      ),
    )
    .innerJoin(area, and(eq(observation.areaId, area.id), eq(area.code, areaCode)))
    .where(isNull(observation.deletedAt))
    .orderBy(asc(observation.fromDate), asc(observation.toDate));

  if (rows.length === 0) {
    const [indicatorExists] = await db
      .select({ id: indicator.id })
      .from(indicator)
      .where(and(eq(indicator.fingertipsId, fingertipsId), eq(indicator.status, 'approved')))
      .limit(1);
    const [areaRow] = await db
      .select({ name: area.name })
      .from(area)
      .where(eq(area.code, areaCode))
      .limit(1);

    if (!indicatorExists || !areaRow) {
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

  return {
    areaCode,
    areaName: rows[0]?.areaName ?? areaCode,
    observations: rows.map(({ obsId, areaName: _areaName, ...observationRow }) => ({
      ...observationRow,
      dimensions: (dimensionsByObservation.get(obsId) ?? []).sort((a, b) =>
        a.type.localeCompare(b.type),
      ),
    })),
  };
}
