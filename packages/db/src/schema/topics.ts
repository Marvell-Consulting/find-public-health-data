import { pgTable, text } from 'drizzle-orm/pg-core';

import { timestamps, uuidPrimaryKey } from './helpers.js';

export const topics = pgTable('topics', {
  id: uuidPrimaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  description: text().notNull(),
  ...timestamps,
});
