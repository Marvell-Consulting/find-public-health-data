import { asc, eq } from 'drizzle-orm';

import type { Database } from './client.js';
import { indicator } from './schema/index.js';

export interface ApprovedIndicator {
  id: string;
  fingertipsId: number;
  name: string;
  status: string;
}

/** The published indicator surface: approved rows only, ordered by name. */
export async function listApprovedIndicators(db: Database): Promise<ApprovedIndicator[]> {
  return db
    .select({
      id: indicator.id,
      fingertipsId: indicator.fingertipsId,
      name: indicator.name,
      status: indicator.status,
    })
    .from(indicator)
    .where(eq(indicator.status, 'approved'))
    .orderBy(asc(indicator.name));
}
