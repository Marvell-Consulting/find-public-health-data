import { doublePrecision, pgTable, text } from 'drizzle-orm/pg-core';

import { uuidPrimaryKey } from './helpers.js';

export const valueType = pgTable('value_type', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

export const unit = pgTable('unit', {
  id: uuidPrimaryKey(),
  name: text().notNull(),
  label: text().notNull(),
  multiplier: doublePrecision().notNull().default(1.0),
});

export const yearType = pgTable('year_type', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

export const ciMethod = pgTable('ci_method', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
  description: text(),
});

export const polarity = pgTable('polarity', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

export const frequency = pgTable('frequency', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

export const comparatorMethod = pgTable('comparator_method', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

export const dataSource = pgTable('data_source', {
  id: uuidPrimaryKey(),
  name: text().notNull(),
  url: text(),
});

export const numeratorDenominatorSource = pgTable('numerator_denominator_source', {
  id: uuidPrimaryKey(),
  name: text().notNull(),
  url: text(),
});
