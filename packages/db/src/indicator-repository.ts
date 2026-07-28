import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Database } from './client.js';
import {
  ciMethod,
  dataSource,
  frequency,
  indicator,
  indicatorMetadata,
  numeratorDenominatorSource,
  polarity,
  unit,
  valueType,
  yearType,
} from './schema/index.js';

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
    .leftJoin(indicatorMetadata, eq(indicatorMetadata.indicatorId, indicator.id))
    .leftJoin(dataSource, eq(indicatorMetadata.dataSourceId, dataSource.id))
    .leftJoin(numeratorSource, eq(indicatorMetadata.numeratorSourceId, numeratorSource.id))
    .leftJoin(denominatorSource, eq(indicatorMetadata.denominatorSourceId, denominatorSource.id))
    .where(and(eq(indicator.fingertipsId, fingertipsId), eq(indicator.status, 'approved')))
    .limit(1);

  if (!row) {
    return undefined;
  }

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
  };
}
