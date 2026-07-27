import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { audit, uuidPrimaryKey } from './helpers.js';
import {
  ciMethod,
  comparatorMethod,
  dataSource,
  frequency,
  numeratorDenominatorSource,
  polarity,
  unit,
  valueType,
  yearType,
} from './lookup.js';

export const indicator = pgTable(
  'indicator',
  {
    id: uuidPrimaryKey(),
    // The public Fingertips indicator number (e.g. 108, 92443), referenced in years
    // of published URLs and documents; preserved as a stable domain identifier.
    fingertipsId: integer().notNull().unique(),
    name: text().notNull(),
    valueTypeId: uuid()
      .notNull()
      .references(() => valueType.id),
    unitId: uuid()
      .notNull()
      .references(() => unit.id),
    yearTypeId: uuid()
      .notNull()
      .references(() => yearType.id),
    ciMethodId: uuid().references(() => ciMethod.id),
    polarityId: uuid()
      .notNull()
      .references(() => polarity.id),
    frequencyId: uuid()
      .notNull()
      .references(() => frequency.id),
    comparatorMethodId: uuid().references(() => comparatorMethod.id),
    disclosureThreshold: smallint(),
    ciConfidenceLevel: text(),
    supersedesId: uuid().references((): AnyPgColumn => indicator.id),
    status: text().notNull().default('approved'),
    reviewedAt: timestamp({ withTimezone: true }),
    reviewedBy: text(),
    config: jsonb(),
    ...audit,
  },
  (t) => [
    check(
      'indicator_ci_confidence_level_check',
      sql`${t.ciConfidenceLevel} IN ('95', '99.8', 'both')`,
    ),
    check(
      'indicator_status_check',
      sql`${t.status} IN ('draft', 'in_review', 'approved', 'archived')`,
    ),
    index('idx_indicator_name_trgm').using('gin', t.name.op('gin_trgm_ops')),
  ],
);

export const indicatorMetadata = pgTable(
  'indicator_metadata',
  {
    id: uuidPrimaryKey(),
    indicatorId: uuid()
      .notNull()
      .unique()
      .references(() => indicator.id),
    definition: text(),
    rationale: text(),
    methodology: text(),
    numeratorDefinition: text(),
    denominatorDefinition: text(),
    disclosureControl: text(),
    caveats: text(),
    notes: text(),
    dataSourceId: uuid().references(() => dataSource.id),
    numeratorSourceId: uuid().references(() => numeratorDenominatorSource.id),
    denominatorSourceId: uuid().references(() => numeratorDenominatorSource.id),
  },
  (t) => [index('idx_indmeta_definition_trgm').using('gin', t.definition.op('gin_trgm_ops'))],
);
