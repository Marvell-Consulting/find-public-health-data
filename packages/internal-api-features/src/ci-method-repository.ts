import { type Database, schema } from '@fphd/db';
import { asc, eq } from 'drizzle-orm';

const { ciMethod } = schema;

export type CiMethodRow = typeof ciMethod.$inferSelect;

/** Every confidence interval method, in the order the publisher's form lists them. */
export async function listCiMethods(db: Database): Promise<CiMethodRow[]> {
  return db.select().from(ciMethod).orderBy(asc(ciMethod.name));
}

export async function getCiMethodById(db: Database, id: string): Promise<CiMethodRow | undefined> {
  const rows = await db.select().from(ciMethod).where(eq(ciMethod.id, id));

  return rows[0];
}
