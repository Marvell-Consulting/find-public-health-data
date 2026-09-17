import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  jsonb,
  pgSequence,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { audit, timestamps, uuidPrimaryKey } from './helpers.js';
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

export const INDICATOR_STATUSES = ['draft', 'in_review', 'approved', 'archived'] as const;

export type IndicatorStatus = (typeof INDICATOR_STATUSES)[number];

export const indicator = pgTable(
  'indicator',
  {
    id: uuidPrimaryKey(),
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
    // When the source system last published data for this indicator. Distinct from the
    // audit timestamps, which record when our own row changed.
    dataUpdatedAt: timestamp({ withTimezone: true }),
    status: text({ enum: INDICATOR_STATUSES }).notNull().default('approved'),
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

/**
 * New indicators take their number from here. It starts high enough that a Fingertips
 * number imported later can never collide with one this service minted.
 */
export const indicatorNumberSequence = pgSequence('indicator_number_seq', {
  startWith: 1000000,
  minValue: 1000000,
});

/**
 * Every public address an indicator answers to: its number, and one or more slugs derived
 * from titles it has had. A slug of nothing but digits is the number — there is no column
 * for the distinction because the slug already says. The invariants are indexes and checks
 * rather than repository code, so a second writer cannot break them.
 */
export const indicatorAlias = pgTable(
  'indicator_alias',
  {
    id: uuidPrimaryKey(),
    indicatorId: uuid()
      .notNull()
      .references(() => indicator.id),
    slug: text().notNull().unique(),
    isPublished: boolean().notNull().default(false),
    isCanonical: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('idx_indicator_alias_number').on(t.indicatorId).where(sql`${t.slug} ~ '^[0-9]+$'`),
    uniqueIndex('idx_indicator_alias_canonical').on(t.indicatorId).where(sql`${t.isCanonical}`),
    // One pending title slug: a draft's title change rewrites its slug rather than adding one.
    uniqueIndex('idx_indicator_alias_pending')
      .on(t.indicatorId)
      .where(sql`${t.slug} !~ '^[0-9]+$' AND NOT ${t.isPublished}`),
    check(
      'indicator_alias_canonical_published_check',
      sql`NOT ${t.isCanonical} OR ${t.isPublished}`,
    ),
    check(
      'indicator_alias_canonical_slug_check',
      sql`NOT ${t.isCanonical} OR ${t.slug} !~ '^[0-9]+$'`,
    ),
    // SLUG_PATTERN in @fphd/config, which slugify is written against.
    check('indicator_alias_slug_check', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
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
