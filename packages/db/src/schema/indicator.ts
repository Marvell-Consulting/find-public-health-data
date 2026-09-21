import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
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

export const INDICATOR_VERSION_STATUSES = ['draft', 'published'] as const;

export type IndicatorVersionStatus = (typeof INDICATOR_VERSION_STATUSES)[number];

// Starts above every Fingertips number carried over in the seed, so this service's own
// numbering is visible at a glance.
export const indicatorShortIdSeq = pgSequence('indicator_short_id_seq', { startWith: 100000 });

/** The indicator's identity: nothing here is editable, so nothing here is versioned. */
export const indicator = pgTable('indicator', {
  id: uuidPrimaryKey(),
  // The public indicator number, carried over from Fingertips where there was one and
  // minted here otherwise; it appears in published URLs, so it never changes.
  shortId: integer().notNull().unique().default(sql`nextval('indicator_short_id_seq')`),
  // When the source system last published data for this indicator. It describes the data,
  // not the editorial content, so it stays off the version.
  dataUpdatedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Everything a publisher edits, one row per draft or publication. Attribute columns are
 * nullable so a draft can be incomplete; completeness is checked when a draft is
 * submitted, not by the table.
 */
export const indicatorVersion = pgTable(
  'indicator_version',
  {
    id: uuidPrimaryKey(),
    indicatorId: uuid()
      .notNull()
      .references(() => indicator.id),
    status: text({ enum: INDICATOR_VERSION_STATUSES }).notNull().default('draft'),
    publishedAt: timestamp({ withTimezone: true }),
    // A draft is only ever created from the page that asks for a name.
    name: text().notNull(),
    valueTypeId: uuid().references(() => valueType.id),
    unitId: uuid().references(() => unit.id),
    yearTypeId: uuid().references(() => yearType.id),
    ciMethodId: uuid().references(() => ciMethod.id),
    polarityId: uuid().references(() => polarity.id),
    frequencyId: uuid().references(() => frequency.id),
    comparatorMethodId: uuid().references(() => comparatorMethod.id),
    disclosureThreshold: smallint(),
    ciConfidenceLevel: text(),
    config: jsonb(),
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
    ...audit,
    // The writer of a version is always known: a publisher, or the seed's system actor.
    createdBy: text().notNull(),
    updatedBy: text().notNull(),
  },
  (t) => [
    check(
      'indicator_version_ci_confidence_level_check',
      sql`${t.ciConfidenceLevel} IN ('95', '99.8', 'both')`,
    ),
    check('indicator_version_status_check', sql`${t.status} IN ('draft', 'published')`),
    // One published and one draft version per indicator, as constraints rather than convention.
    uniqueIndex('idx_indicator_version_one_published')
      .on(t.indicatorId)
      .where(sql`${t.status} = 'published'`),
    uniqueIndex('idx_indicator_version_one_draft')
      .on(t.indicatorId)
      .where(sql`${t.status} = 'draft'`),
    index('idx_indicator_version_indicator').on(t.indicatorId),
    index('idx_indicator_version_name_trgm').using('gin', t.name.op('gin_trgm_ops')),
    index('idx_indicator_version_definition_trgm').using('gin', t.definition.op('gin_trgm_ops')),
  ],
);
