import { sql } from 'drizzle-orm';

import { type Actor, type AuditEntry, changesBetween, fromColumnNames } from './audit-log.ts';
import { SYSTEM_USER_IDS } from './schema/index.ts';

/** The core data import writes as its own system user, outside any request. */
export const CORE_DATA_IMPORT: Actor = { userId: SYSTEM_USER_IDS.coreDataImport, requestId: null };

/** An upsert's row before and after, for its `returning`; before is null for an insert. */
export const upsertedRow = {
  before: sql<Record<string, unknown> | null>`to_jsonb(old)`,
  after: sql<Record<string, unknown>>`to_jsonb(new)`,
};

type CoreDataEntity =
  | 'topic'
  | 'ci_method'
  | 'classification'
  | 'data_provider'
  | 'data_provider_source'
  | 'value_type'
  | 'unit'
  | 'comparator_method';

/** An entry for each row an upsert wrote: created where it inserted, updated where it rewrote. */
export function upsertEntries(
  entity: CoreDataEntity,
  rows: readonly { before: Record<string, unknown> | null; after: Record<string, unknown> }[],
): AuditEntry[] {
  return rows.map(({ before, after }) => {
    const row = fromColumnNames(after);
    return {
      action: before === null ? (`${entity}.created` as const) : (`${entity}.updated` as const),
      entityId: String(row.id),
      changes: changesBetween(before === null ? null : fromColumnNames(before), row),
    };
  });
}
