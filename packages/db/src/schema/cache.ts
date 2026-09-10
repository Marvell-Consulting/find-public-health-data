import {
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Derived read models rebuilt from canonical tables; deliberately no foreign keys so
// they can be truncated and rebuilt independently.

export const latestHeadline = pgTable(
  'latest_headline',
  {
    indicatorId: uuid().notNull(),
    areaId: uuid().notNull(),
    fromDate: date().notNull(),
    toDate: date().notNull(),
    value: doublePrecision(),
    lowerCi95: doublePrecision('lower_ci_95'),
    upperCi95: doublePrecision('upper_ci_95'),
  },
  (t) => [
    index('idx_latest_headline_area').on(t.areaId),
    index('idx_latest_headline_indicator').on(t.indicatorId),
    uniqueIndex('idx_latest_headline_indicator_area').on(t.indicatorId, t.areaId),
  ],
);

export const availableData = pgTable(
  'available_data',
  {
    indicatorId: uuid().notNull(),
    areaTypeId: uuid().notNull(),
    areaTypeName: text().notNull(),
    areaCount: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.indicatorId, t.areaTypeId] }),
    index('idx_available_data_area_indicator').on(t.areaTypeId, t.indicatorId),
  ],
);

export const indicatorDimensionValues = pgTable(
  'indicator_dimension_values',
  {
    indicatorId: uuid().notNull(),
    dimensionTypeId: uuid().notNull(),
    dimensionTypeName: text().notNull(),
    dimensionValueId: uuid().notNull(),
    dimensionValueName: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.indicatorId, t.dimensionValueId] }),
    index('idx_indicator_dimension_values_type_indicator').on(t.dimensionTypeId, t.indicatorId),
  ],
);
