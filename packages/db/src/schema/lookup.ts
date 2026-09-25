import { sql } from 'drizzle-orm';
import { check, pgTable, text } from 'drizzle-orm/pg-core';

import { uuidPrimaryKey } from './helpers.ts';

// The rows of these two are the vocabularies in @fphd/utils/value-type-and-unit, inserted by migration.
export const valueType = pgTable('value_type', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

export const unit = pgTable('unit', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

// The rows of these two are the vocabularies in @fphd/utils/period-type, inserted by migration.
export const periodType = pgTable('period_type', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

export const yearType = pgTable('year_type', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

/**
 * What choosing a method asks of a publisher next: a standard method's modifications, an
 * other method's detail, or nothing for a method that has none to describe.
 */
export const CI_METHOD_KINDS = ['standard', 'other', 'none'] as const;

export const ciMethod = pgTable(
  'ci_method',
  {
    id: uuidPrimaryKey(),
    name: text().notNull().unique(),
    description: text(),
    kind: text({ enum: CI_METHOD_KINDS }).notNull().default('standard'),
  },
  (t) => [check('ci_method_kind_check', sql`${t.kind} IN ('standard', 'other', 'none')`)],
);

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
