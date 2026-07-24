import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const topics = pgTable('topics', {
  // No DB default: ids are assigned by the seed/import file, not generated here.
  id: uuid().primaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  description: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
