import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The only objects `public_api` may read. The views carry the predicates that keep an
 * unpublished indicator out, so no query has to remember them; the definitions live in a
 * custom migration and are declared here as existing so drizzle-kit never rewrites them.
 * Exports are prefixed because the table names are taken.
 */
export const publishedSchema = pgSchema('published');

export const publishedIndicator = publishedSchema
  .view('indicator', {
    id: uuid().notNull(),
    shortId: integer().notNull(),
    dataUpdatedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    // A version is complete before it can be published, so the public surface always has a name.
    name: text().notNull(),
    valueTypeId: uuid(),
    unitId: uuid(),
    yearTypeId: uuid(),
    ciMethodId: uuid(),
    polarityId: uuid(),
    frequencyId: uuid(),
    comparatorMethodId: uuid(),
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
    dataSourceId: uuid(),
    numeratorSourceId: uuid(),
    denominatorSourceId: uuid(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
    firstPublishedAt: timestamp({ withTimezone: true }),
    lastPublishedAt: timestamp({ withTimezone: true }),
  })
  .existing();

export const publishedIndicatorTopic = publishedSchema
  .view('indicator_topic', {
    indicatorId: uuid().notNull(),
    topicId: uuid().notNull(),
  })
  .existing();

export const publishedIndicatorClassification = publishedSchema
  .view('indicator_classification', {
    indicatorId: uuid().notNull(),
    classificationId: uuid().notNull(),
  })
  .existing();

export const publishedTopic = publishedSchema
  .view('topic', {
    id: uuid().notNull(),
    slug: text().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  })
  .existing();

export const publishedClassification = publishedSchema
  .view('classification', {
    id: uuid().notNull(),
    dimension: text().notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  })
  .existing();

export const publishedValueType = publishedSchema
  .view('value_type', { id: uuid().notNull(), name: text().notNull() })
  .existing();

export const publishedUnit = publishedSchema
  .view('unit', {
    id: uuid().notNull(),
    name: text().notNull(),
    label: text().notNull(),
    multiplier: doublePrecision().notNull(),
  })
  .existing();

export const publishedYearType = publishedSchema
  .view('year_type', { id: uuid().notNull(), name: text().notNull() })
  .existing();

export const publishedCiMethod = publishedSchema
  .view('ci_method', { id: uuid().notNull(), name: text().notNull(), description: text() })
  .existing();

export const publishedPolarity = publishedSchema
  .view('polarity', { id: uuid().notNull(), name: text().notNull() })
  .existing();

export const publishedFrequency = publishedSchema
  .view('frequency', { id: uuid().notNull(), name: text().notNull() })
  .existing();

export const publishedComparatorMethod = publishedSchema
  .view('comparator_method', { id: uuid().notNull(), name: text().notNull() })
  .existing();

export const publishedDataSource = publishedSchema
  .view('data_source', { id: uuid().notNull(), name: text().notNull(), url: text() })
  .existing();

export const publishedNumeratorDenominatorSource = publishedSchema
  .view('numerator_denominator_source', {
    id: uuid().notNull(),
    name: text().notNull(),
    url: text(),
  })
  .existing();

export const publishedDimensionType = publishedSchema
  .view('dimension_type', {
    id: uuid().notNull(),
    name: text().notNull(),
    dimensionClass: text().notNull(),
    classificationScheme: text(),
    granularity: text(),
    schemeVersion: text(),
    isRequired: boolean().notNull(),
  })
  .existing();

export const publishedDimensionValue = publishedSchema
  .view('dimension_value', {
    id: uuid().notNull(),
    dimensionTypeId: uuid().notNull(),
    parentId: uuid(),
    name: text().notNull(),
    code: text(),
    sortOrder: integer().notNull(),
    isAggregate: boolean().notNull(),
  })
  .existing();

export const publishedAreaType = publishedSchema
  .view('area_type', {
    id: uuid().notNull(),
    name: text().notNull(),
    hierarchyType: text().notNull(),
    level: integer().notNull(),
    displayGroup: text(),
    displayOrder: integer(),
  })
  .existing();

export const publishedArea = publishedSchema
  .view('area', {
    id: uuid().notNull(),
    code: text().notNull(),
    name: text().notNull(),
    areaTypeId: uuid().notNull(),
    validFrom: date().notNull(),
    validTo: date(),
  })
  .existing();

export const publishedAreaRelationship = publishedSchema
  .view('area_relationship', {
    id: uuid().notNull(),
    parentAreaId: uuid().notNull(),
    childAreaId: uuid().notNull(),
    validFrom: date().notNull(),
    validTo: date(),
  })
  .existing();

export const publishedNoteType = publishedSchema
  .view('note_type', { id: uuid().notNull(), text: text().notNull(), category: text().notNull() })
  .existing();

export const publishedObservation = publishedSchema
  .view('observation', {
    id: uuid().notNull(),
    indicatorId: uuid().notNull(),
    areaId: uuid().notNull(),
    fromDate: date().notNull(),
    toDate: date().notNull(),
    value: doublePrecision(),
    count: doublePrecision(),
    denominator: doublePrecision(),
    denominator2: doublePrecision('denominator_2'),
    lowerCi95: doublePrecision('lower_ci_95'),
    upperCi95: doublePrecision('upper_ci_95'),
    lowerCi998: doublePrecision('lower_ci_998'),
    upperCi998: doublePrecision('upper_ci_998'),
    distributionRank: smallint(),
    publishedAt: timestamp({ withTimezone: true }).notNull(),
    uploadBatchId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  })
  .existing();

export const publishedObservationDimension = publishedSchema
  .view('observation_dimension', {
    id: uuid().notNull(),
    observationId: uuid().notNull(),
    dimensionValueId: uuid().notNull(),
    dimensionTypeId: uuid().notNull(),
  })
  .existing();

export const publishedObservationNote = publishedSchema
  .view('observation_note', {
    id: uuid().notNull(),
    observationId: uuid().notNull(),
    noteTypeId: uuid().notNull(),
  })
  .existing();

export const publishedLatestHeadline = publishedSchema
  .view('latest_headline', {
    indicatorId: uuid().notNull(),
    areaId: uuid().notNull(),
    fromDate: date().notNull(),
    toDate: date().notNull(),
    value: doublePrecision(),
    lowerCi95: doublePrecision('lower_ci_95'),
    upperCi95: doublePrecision('upper_ci_95'),
  })
  .existing();

export const publishedAvailableData = publishedSchema
  .view('available_data', {
    indicatorId: uuid().notNull(),
    areaTypeId: uuid().notNull(),
    areaTypeName: text().notNull(),
    areaCount: integer().notNull(),
  })
  .existing();

export const publishedIndicatorDimensionValues = publishedSchema
  .view('indicator_dimension_values', {
    indicatorId: uuid().notNull(),
    dimensionTypeId: uuid().notNull(),
    dimensionTypeName: text().notNull(),
    dimensionValueId: uuid().notNull(),
    dimensionValueName: text().notNull(),
    sortOrder: integer().notNull(),
  })
  .existing();

export const publishedObservationRange = publishedSchema
  .view('observation_range', {
    indicatorId: uuid().notNull(),
    displayGroup: text().notNull(),
    fromDate: date().notNull(),
    toDate: date().notNull(),
    segment: text().notNull(),
    min: doublePrecision().notNull(),
    max: doublePrecision().notNull(),
  })
  .existing();
