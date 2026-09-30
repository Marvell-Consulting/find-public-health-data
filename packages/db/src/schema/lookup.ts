import { sql } from 'drizzle-orm';
import { check, pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core';

import { timestamps, uuidPrimaryKey } from './helpers.ts';

/** What an indicator's values are: core data, in the order the publisher's form lists them. */
export const valueType = pgTable('value_type', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
  position: smallint().notNull(),
  ...timestamps,
});

/** The units of an indicator's values: core data, like the value types. */
export const unit = pgTable('unit', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
  position: smallint().notNull(),
  ...timestamps,
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

/** How an area is compared with its benchmark: core data, which no page yet asks for. */
export const comparatorMethod = pgTable('comparator_method', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
  ...timestamps,
});

export const dataSource = pgTable('data_source', {
  id: uuidPrimaryKey(),
  name: text().notNull(),
  url: text(),
});

/** An organisation a numerator or denominator's data comes from: core data, like the CI methods. */
export const dataProvider = pgTable('data_provider', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
});

/** One of a provider's named sources; a provider may also be chosen with no specific source. */
export const dataProviderSource = pgTable(
  'data_provider_source',
  {
    id: uuidPrimaryKey(),
    providerId: uuid()
      .notNull()
      .references(() => dataProvider.id),
    name: text().notNull(),
  },
  // The pair is unique so a choice can reference a source together with its provider.
  (t) => [
    unique('data_provider_source_provider_id_name_unique').on(t.providerId, t.name),
    unique('data_provider_source_id_provider_id_unique').on(t.id, t.providerId),
  ],
);
