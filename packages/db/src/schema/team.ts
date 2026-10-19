import { pgTable, text } from 'drizzle-orm/pg-core';

import { timestamps, uuidPrimaryKey } from './helpers.ts';

/** A group of publishers; its rows are inserted by migration, with the ids @fphd/auth uses. */
export const team = pgTable('team', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
  ...timestamps,
});

/** Fingertips, the team imported indicators join, as the seed's do. */
export const IMPORTED_INDICATOR_TEAM_ID = '01a13ca4-5b80-76ba-bda8-93cbb4a49f64';
