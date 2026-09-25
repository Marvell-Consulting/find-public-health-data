import { asc, eq } from 'drizzle-orm';

import type { Database } from './client.ts';
import { publishedTopic, type topic } from './schema/index.ts';

export type Topic = typeof topic.$inferSelect;

/** All topics, ordered alphabetically by title. */
export async function listTopics(db: Database): Promise<Topic[]> {
  return db.select().from(publishedTopic).orderBy(asc(publishedTopic.title));
}

/** The topic with the given slug, or `undefined` if no topic matches. */
export async function getTopicBySlug(db: Database, slug: string): Promise<Topic | undefined> {
  const rows = await db.select().from(publishedTopic).where(eq(publishedTopic.slug, slug));
  return rows[0];
}
