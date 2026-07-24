import { doublePrecision, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const valueType = pgTable('value_type', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
});

export const unit = pgTable('unit', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  label: text().notNull(),
  multiplier: doublePrecision().notNull().default(1.0),
});

export const yearType = pgTable('year_type', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
});

export const ciMethod = pgTable('ci_method', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  description: text(),
});

export const polarity = pgTable('polarity', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
});

export const frequency = pgTable('frequency', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
});

export const comparatorMethod = pgTable('comparator_method', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
});

export const dataSource = pgTable('data_source', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  url: text(),
});

export const numeratorDenominatorSource = pgTable('numerator_denominator_source', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  url: text(),
});
