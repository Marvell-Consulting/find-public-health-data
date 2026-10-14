import { pgTable, text } from 'drizzle-orm/pg-core';

import { timestamps, uuidPrimaryKey } from './helpers.ts';

/** A group of publishers; its rows are inserted by migration, with the ids @fphd/auth uses. */
export const team = pgTable('team', {
  id: uuidPrimaryKey(),
  name: text().notNull().unique(),
  ...timestamps,
});

/** Team A, which an indicator arriving without a team joins, as seeded and imported ones do. */
export const DEFAULT_INDICATOR_TEAM_ID = '01a13c69-96aa-70af-81f9-10856a4023b2';
