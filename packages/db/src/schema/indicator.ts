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
} from 'drizzle-orm/pg-core';

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
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    valueTypeId: integer()
      .notNull()
      .references(() => valueType.id),
    unitId: integer()
      .notNull()
      .references(() => unit.id),
    yearTypeId: integer()
      .notNull()
      .references(() => yearType.id),
    ciMethodId: integer().references(() => ciMethod.id),
    polarityId: integer()
      .notNull()
      .references(() => polarity.id),
    frequencyId: integer()
      .notNull()
      .references(() => frequency.id),
    comparatorMethodId: integer().references(() => comparatorMethod.id),
    disclosureThreshold: smallint(),
    ciConfidenceLevel: text(),
    supersedesId: integer().references((): AnyPgColumn => indicator.id),
    status: text().notNull().default('approved'),
    reviewedAt: timestamp({ withTimezone: true }),
    reviewedBy: text(),
    config: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedBy: text().notNull(),
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
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    indicatorId: integer()
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
    dataSourceId: integer().references(() => dataSource.id),
    numeratorSourceId: integer().references(() => numeratorDenominatorSource.id),
    denominatorSourceId: integer().references(() => numeratorDenominatorSource.id),
  },
  (t) => [index('idx_indmeta_definition_trgm').using('gin', t.definition.op('gin_trgm_ops'))],
);
