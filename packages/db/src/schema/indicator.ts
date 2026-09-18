import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { audit, uuidPrimaryKey } from './helpers.ts';
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
} from './lookup.ts';

export const INDICATOR_STATUSES = ['draft', 'in_review', 'approved', 'archived'] as const;

export type IndicatorStatus = (typeof INDICATOR_STATUSES)[number];

// Starts above every Fingertips number carried over in the seed, so this service's own
// numbering is visible at a glance.
export const indicatorShortIdSeq = pgSequence('indicator_short_id_seq', { startWith: 100000 });

export const indicator = pgTable(
  'indicator',
  {
    id: uuidPrimaryKey(),
    // The public indicator number, carried over from Fingertips where there was one and
    // minted here otherwise; it appears in published URLs, so it never changes.
    shortId: integer().notNull().unique().default(sql`nextval('indicator_short_id_seq')`),
    name: text().notNull(),
    // Everything below is empty on a stub created from a name alone and filled before the
    // indicator is approved.
    valueTypeId: uuid().references(() => valueType.id),
    unitId: uuid().references(() => unit.id),
    yearTypeId: uuid().references(() => yearType.id),
    ciMethodId: uuid().references(() => ciMethod.id),
    polarityId: uuid().references(() => polarity.id),
    frequencyId: uuid().references(() => frequency.id),
    comparatorMethodId: uuid().references(() => comparatorMethod.id),
    disclosureThreshold: smallint(),
    ciConfidenceLevel: text(),
    supersedesId: uuid().references((): AnyPgColumn => indicator.id),
    // When the source system last published data for this indicator. Distinct from the
    // audit timestamps, which record when our own row changed.
    dataUpdatedAt: timestamp({ withTimezone: true }),
    status: text({ enum: INDICATOR_STATUSES }).notNull().default('draft'),
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
