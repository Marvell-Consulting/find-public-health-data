import { POLARITIES } from '@fphd/utils/polarity';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@fphd/utils/slug';
import { UPDATE_FREQUENCIES } from '@fphd/utils/update-frequency';
import { asc, desc, eq, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  pgView,
  primaryKey,
  QueryBuilder,
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
  numeratorDenominatorSource,
  unit,
  valueType,
  yearType,
} from './lookup.ts';

export const INDICATOR_VERSION_STATUSES = ['draft', 'published'] as const;

export type IndicatorVersionStatus = (typeof INDICATOR_VERSION_STATUSES)[number];

/** Who calculated an indicator: OHID, DHSC, or organisations named in `calculated_by_other`. */
export const INDICATOR_CALCULATED_BY = ['ohid', 'dhsc', 'other'] as const;

/** Whether disclosure control was applied, described in `disclosure_control_detail` when it was. */
export const INDICATOR_DISCLOSURE_CONTROL = ['yes', 'no', 'not-applicable'] as const;

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
    // When the publisher asks for this version to be published; published_at records when it was.
    scheduledPublishAt: timestamp({ withTimezone: true }),
    // A draft is only ever created from the page that asks for a name.
    name: text().notNull(),
    // Derived from the name by slugify, and the indicator's public address. An exclusion
    // constraint, which drizzle cannot express, keeps a slug to one indicator for ever.
    slug: text().notNull(),
    valueTypeId: uuid().references(() => valueType.id),
    unitId: uuid().references(() => unit.id),
    yearTypeId: uuid().references(() => yearType.id),
    ciMethodId: uuid().references(() => ciMethod.id),
    // Asked of a standard CI method only, and the modifications only when there were some.
    ciMethodModified: boolean(),
    ciMethodModifications: text(),
    // Asked of an other CI method only.
    ciMethodOtherDetail: text(),
    polarity: text({ enum: POLARITIES }),
    updateFrequency: text({ enum: UPDATE_FREQUENCIES }),
    comparatorMethodId: uuid().references(() => comparatorMethod.id),
    disclosureThreshold: smallint(),
    ciConfidenceLevel: text(),
    config: jsonb(),
    definition: text(),
    rationale: text(),
    methodology: text(),
    calculatedBy: text({ enum: INDICATOR_CALCULATED_BY }),
    calculatedByOther: text(),
    // Null until answered, so "no links" is told apart from a question not yet asked.
    hasLinks: boolean(),
    numeratorDefinition: text(),
    denominatorDefinition: text(),
    // Each answer's detail is asked for, and kept, only when the answer is yes.
    disclosureControl: text({ enum: INDICATOR_DISCLOSURE_CONTROL }),
    disclosureControlDetail: text(),
    roundingApplied: boolean(),
    roundingDetail: text(),
    caveatsNeeded: boolean(),
    caveatsDetail: text(),
    otherNotesNeeded: boolean(),
    otherNotesDetail: text(),
    // Notes for reviewers, never published.
    variation: text(),
    qualityAssurance: text(),
    sourceDataIssues: boolean(),
    sourceDataIssuesDetail: text(),
    ciMethodJustification: text(),
    dataSourcesJustification: text(),
    inequalitiesIncluded: text(),
    hasExclusions: boolean(),
    exclusionsDetail: text(),
    automationUsed: boolean(),
    automationDetail: text(),
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
    check(
      'indicator_version_polarity_check',
      sql`${t.polarity} IN (${sql.raw(POLARITIES.map((value) => `'${value}'`).join(', '))})`,
    ),
    check(
      'indicator_version_update_frequency_check',
      sql`${t.updateFrequency} IN (${sql.raw(UPDATE_FREQUENCIES.map((value) => `'${value}'`).join(', '))})`,
    ),
    check(
      'indicator_version_calculated_by_check',
      sql`${t.calculatedBy} IN ('ohid', 'dhsc', 'other')`,
    ),
    // Other organisations only beside "other"; null-safe, so no choice refuses them too.
    check(
      'indicator_version_calculated_by_other_check',
      sql`${t.calculatedBy} IS NOT DISTINCT FROM 'other' OR ${t.calculatedByOther} IS NULL`,
    ),
    check(
      'indicator_version_disclosure_control_check',
      sql`${t.disclosureControl} IN ('yes', 'no', 'not-applicable')`,
    ),
    check(
      'indicator_version_disclosure_control_detail_check',
      sql`${t.disclosureControl} IS NOT DISTINCT FROM 'yes' OR ${t.disclosureControlDetail} IS NULL`,
    ),
    check(
      'indicator_version_rounding_detail_check',
      sql`${t.roundingApplied} IS TRUE OR ${t.roundingDetail} IS NULL`,
    ),
    check(
      'indicator_version_caveats_detail_check',
      sql`${t.caveatsNeeded} IS TRUE OR ${t.caveatsDetail} IS NULL`,
    ),
    check(
      'indicator_version_other_notes_detail_check',
      sql`${t.otherNotesNeeded} IS TRUE OR ${t.otherNotesDetail} IS NULL`,
    ),
    check(
      'indicator_version_source_data_issues_detail_check',
      sql`${t.sourceDataIssues} IS TRUE OR ${t.sourceDataIssuesDetail} IS NULL`,
    ),
    check(
      'indicator_version_exclusions_detail_check',
      sql`${t.hasExclusions} IS TRUE OR ${t.exclusionsDetail} IS NULL`,
    ),
    check(
      'indicator_version_automation_detail_check',
      sql`${t.automationUsed} IS TRUE OR ${t.automationDetail} IS NULL`,
    ),
    // A published version always says when, and nothing else does, so ordering by
    // published_at never meets a null.
    check(
      'indicator_version_published_at_check',
      sql`(${t.status} = 'published') = (${t.publishedAt} IS NOT NULL)`,
    ),
    // The shape slugify yields and a short id cannot take; reserved words are checked by the app.
    check(
      'indicator_version_slug_check',
      sql`${t.slug} ~ ${sql.raw(`'${SLUG_PATTERN.source}'`)} AND ${t.slug} !~ '^[0-9]+$' AND length(${t.slug}) <= ${sql.raw(String(SLUG_MAX_LENGTH))}`,
    ),
    // One draft per indicator, as a constraint rather than a convention. An indicator may
    // hold several published versions; reads take the most recently published one.
    uniqueIndex('idx_indicator_version_one_draft')
      .on(t.indicatorId)
      .where(sql`${t.status} = 'draft'`),
    index('idx_indicator_version_indicator').on(t.indicatorId),
    index('idx_indicator_version_slug').on(t.slug),
    index('idx_indicator_version_name_trgm').using('gin', t.name.op('gin_trgm_ops')),
    index('idx_indicator_version_definition_trgm').using('gin', t.definition.op('gin_trgm_ops')),
  ],
);

/** The links a version offers users, in the order the publisher added them. */
export const indicatorVersionLink = pgTable(
  'indicator_version_link',
  {
    indicatorVersionId: uuid()
      .notNull()
      .references(() => indicatorVersion.id),
    position: smallint().notNull(),
    url: text().notNull(),
    text: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.indicatorVersionId, t.position] }),
    check('indicator_version_link_position_check', sql`${t.position} >= 0`),
  ],
);

/**
 * The one definition of "the published version": an indicator may hold several, and this
 * is the most recently published one, ties broken by id (UUIDv7, so creation order). The
 * `published` views and the internal reads join this rather than restating the rule, then
 * join `indicator_version` by `id` for the columns. It names the version and nothing else,
 * so a new version column never changes its definition or the views built on it.
 * Postgres pushes an `indicator_id` predicate into the DISTINCT ON, so a lookup by
 * indicator costs the same as it would against the table.
 *
 * Built on a QueryBuilder of its own: the one `.as()` would hand a callback carries no
 * casing, and drizzle-kit would then render the select list under the TypeScript names.
 */
export const currentPublishedVersion = pgView('current_published_version').as(
  new QueryBuilder({ casing: 'snake_case' })
    .selectDistinctOn([indicatorVersion.indicatorId], {
      id: indicatorVersion.id,
      indicatorId: indicatorVersion.indicatorId,
    })
    .from(indicatorVersion)
    .where(eq(indicatorVersion.status, 'published'))
    .orderBy(
      asc(indicatorVersion.indicatorId),
      desc(indicatorVersion.publishedAt),
      desc(indicatorVersion.id),
    ),
);
