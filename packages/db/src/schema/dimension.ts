import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';

export const dimensionType = pgTable(
  'dimension_type',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull().unique(),
    dimensionClass: text().notNull(),
    classificationScheme: text(),
    granularity: text(),
    schemeVersion: text(),
    isRequired: boolean().notNull().default(false),
  },
  (t) => [
    check(
      'dimension_type_dimension_class_check',
      sql`${t.dimensionClass} IN ('core', 'inequality', 'demographic', 'clinical')`,
    ),
  ],
);

export const dimensionValue = pgTable(
  'dimension_value',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    dimensionTypeId: integer()
      .notNull()
      .references(() => dimensionType.id),
    parentId: integer().references((): AnyPgColumn => dimensionValue.id),
    name: text().notNull(),
    code: text(),
    sortOrder: integer().notNull().default(0),
    isAggregate: boolean().notNull().default(false),
  },
  (t) => [
    unique().on(t.dimensionTypeId, t.name),
    index('idx_dim_val_type').on(t.dimensionTypeId),
    index('idx_dim_val_parent').on(t.parentId).where(sql`${t.parentId} IS NOT NULL`),
  ],
);
