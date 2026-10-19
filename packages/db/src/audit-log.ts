import { isDeepStrictEqual } from 'node:util';

import { sql } from 'drizzle-orm';

import type { Database } from './client.ts';
import { type AuditAction, type AuditChanges, auditLog, type FieldChange } from './schema/index.ts';

export type { AuditAction, AuditChanges, FieldChange } from './schema/index.ts';

/** Who makes a change: an `app_user`, and the request it came in, if any. */
export interface Actor {
  userId: string;
  requestId: string | null;
}

export interface AuditEntry {
  action: AuditAction;
  entityId: string;
  changes: AuditChanges;
}

/**
 * Records the entries in the transaction of the change they describe, so the change and its
 * record commit or fail together. The entity type is the action's prefix.
 */
export async function recordAudit(
  tx: Pick<Database, 'insert'>,
  actor: Actor,
  entries: readonly AuditEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  await tx.insert(auditLog).values(
    entries.map(({ action, entityId, changes }) => ({
      actorId: actor.userId,
      requestId: actor.requestId,
      action,
      entityType: action.slice(0, action.indexOf('.')),
      entityId,
      // As text: a raw client serialises jsonb parameters itself and would encode it twice.
      changes: sql`${JSON.stringify(changes)}::text::jsonb`,
    })),
  );
}

// The entry itself records who made the change and when.
const AUDIT_COLUMNS = new Set(['createdAt', 'createdBy', 'updatedAt', 'updatedBy']);

function jsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

/**
 * The fields that differ between two versions of a row: a null `before` for a row created, a
 * null `after` for one deleted.
 */
export function changesBetween(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditChanges {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  return Object.fromEntries(
    [...fields]
      .filter((field) => !AUDIT_COLUMNS.has(field))
      .map((field): [string, FieldChange] => [
        field,
        { before: jsonValue(before?.[field]), after: jsonValue(after?.[field]) },
      ])
      .filter(([, change]) => !isDeepStrictEqual(change.before, change.after)),
  );
}

function sorted(list: readonly unknown[]): unknown[] {
  return [...list].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/**
 * The lists in `after` whose contents differ from `before`, each whole. The `unordered` lists
 * are sets, so only their members count.
 */
export function listChanges(
  before: Record<string, readonly unknown[]>,
  after: Record<string, readonly unknown[]>,
  unordered: readonly string[] = [],
): AuditChanges {
  return Object.fromEntries(
    Object.entries(after)
      .map(([field, list]): [string, FieldChange] => [
        field,
        { before: before[field] ?? [], after: list },
      ])
      .filter(([field, { before: was, after: is }]) =>
        unordered.includes(field)
          ? !isDeepStrictEqual(sorted(was as unknown[]), sorted(is as unknown[]))
          : !isDeepStrictEqual(was, is),
      ),
  );
}
