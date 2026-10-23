import { getTableName, sql, type Table } from 'drizzle-orm';

import { type Actor, type AuditEntry, changesBetween, rowOf } from './audit-log.ts';
import { CORE_DATA_TABLES, SYSTEM_USER_IDS } from './schema/index.ts';

/** The core data import writes as its own system user, outside any request. */
export const CORE_DATA_IMPORT: Actor = { userId: SYSTEM_USER_IDS.coreDataImport, requestId: null };

/** An upsert's row before and after, for its `returning`; before is null for an insert. */
export const upsertedRow = {
  before: sql<Record<string, unknown> | null>`to_jsonb(old)`,
  after: sql<Record<string, unknown>>`to_jsonb(new)`,
};

type CoreDataEntity = (typeof CORE_DATA_TABLES)[number] | 'topic';

function isCoreDataEntity(name: string): name is CoreDataEntity {
  return name === 'topic' || (CORE_DATA_TABLES as readonly string[]).includes(name);
}

/** An entry for each row an upsert wrote: created where it inserted, updated where it rewrote. */
export function upsertEntries(
  table: Table,
  rows: readonly { before: Record<string, unknown> | null; after: Record<string, unknown> }[],
): AuditEntry[] {
  const entity = getTableName(table);
  if (!isCoreDataEntity(entity)) throw new Error(`${entity} is not core data`);

  return rows.map(({ before, after }) => {
    const row = rowOf(table, after);
    return {
      action: before === null ? (`${entity}.created` as const) : (`${entity}.updated` as const),
      entityId: String(row.id),
      changes: changesBetween(before === null ? null : rowOf(table, before), row),
    };
  });
}
