import { type Database, schema } from '@fphd/db';
import { type Actor, type AuditAction, changesBetween, recordAudit } from '@fphd/db/audit-log';
import type { IndicatorSubmissionStatus } from '@fphd/utils/indicator-submission-status';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { CiMethodKind, IndicatorStep } from './contract.ts';
import {
  draftListsOf,
  type IndicatorDraftVersion,
  isPublished,
} from './indicator-draft-repository.ts';
import type { Transaction } from './indicator-repository-sql.ts';
import { isDraftComplete } from './indicator-task-list.ts';
import { nextState } from './indicator-workflow.ts';

const { ciMethod, indicatorVersion, indicatorVersionSubmission } = schema;

type Submission = typeof indicatorVersionSubmission.$inferSelect;

export type IndicatorStepResult<Reason extends string = never> =
  | { ok: true }
  | { ok: false; reason: 'no_draft' | 'not_allowed' | Reason };

/**
 * A step's own check of the draft and its latest submission, made under the draft's lock: why
 * the step is refused, or nothing.
 */
export type IndicatorStepPrecondition<Reason extends string> = (
  tx: Transaction,
  state: { draft: IndicatorDraftVersion; latest: Submission | undefined },
) => Promise<Reason | undefined>;

const STEP_ACTIONS: Readonly<Record<IndicatorStep, AuditAction>> = {
  submit: 'indicator.submitted',
  withdraw: 'indicator.submission_withdrawn',
};

interface SubmissionWrite {
  tx: Transaction;
  draft: IndicatorDraftVersion;
  latest: Submission | undefined;
  status: IndicatorSubmissionStatus;
  actor: Actor;
}

/** Each step's write of a submission, answering the row before (null when inserted) and after. */
const SUBMISSION_WRITES: Readonly<
  Record<
    IndicatorStep,
    (write: SubmissionWrite) => Promise<{ before: Submission | null; after: Submission }>
  >
> = {
  submit: async ({ tx, draft, latest, status, actor }) => {
    const [after] = await tx
      .insert(indicatorVersionSubmission)
      .values({
        indicatorVersionId: draft.id,
        indicatorId: draft.indicatorId,
        number: (latest?.number ?? 0) + 1,
        status,
        submittedBy: actor.userId,
      })
      .returning();
    if (after === undefined) throw new Error('submit inserted no submission');
    return { before: null, after };
  },
  withdraw: async ({ tx, latest, status, actor }) => {
    if (latest === undefined) throw new Error('withdraw found no submission to end');
    const [after] = await tx
      .update(indicatorVersionSubmission)
      .set({ status, endedBy: actor.userId, endedAt: sql`clock_timestamp()` })
      .where(eq(indicatorVersionSubmission.id, latest.id))
      .returning();
    if (after === undefined) throw new Error(`withdraw updated no submission ${latest.id}`);
    return { before: latest, after };
  },
};

/**
 * Takes a workflow step on the indicator's draft in one transaction: the version's lock, its
 * submission and the audit entry are written together or not at all. A step is not an edit, so
 * the version's `updated_at` and `updated_by` stay as the last edit left them.
 */
export async function takeIndicatorStep<Reason extends string = never>(
  db: Database,
  indicatorId: string,
  step: IndicatorStep,
  actor: Actor,
  { precondition }: { precondition?: IndicatorStepPrecondition<Reason> } = {},
): Promise<IndicatorStepResult<Reason>> {
  return db.transaction(async (tx): Promise<IndicatorStepResult<Reason>> => {
    // No key update, so an upload's foreign key share on the version does not hold the step up.
    // A refused load's FOR SHARE does until it commits, but it never writes the row: no deadlock.
    const [draft] = await tx
      .select()
      .from(indicatorVersion)
      .where(
        and(eq(indicatorVersion.indicatorId, indicatorId), eq(indicatorVersion.status, 'draft')),
      )
      .for('no key update');

    if (draft === undefined) return { ok: false, reason: 'no_draft' };

    const [latest] = await tx
      .select()
      .from(indicatorVersionSubmission)
      .where(eq(indicatorVersionSubmission.indicatorVersionId, draft.id))
      .orderBy(desc(indicatorVersionSubmission.number))
      .limit(1);
    const next = nextState(
      {
        indicatorStatus: (await isPublished(tx, indicatorId)) ? 'live' : 'new',
        versionStatus: draft.status,
        isLocked: draft.isLocked,
        latestSubmissionStatus: latest?.status ?? null,
      },
      step,
    );

    if (!next.ok) return next;

    const refusal = await precondition?.(tx, { draft, latest });
    if (refusal !== undefined) return { ok: false, reason: refusal };

    const [version] = await tx
      .update(indicatorVersion)
      .set({ status: next.state.versionStatus, isLocked: next.state.isLocked })
      .where(eq(indicatorVersion.id, draft.id))
      .returning({ status: indicatorVersion.status, isLocked: indicatorVersion.isLocked });
    if (version === undefined)
      throw new Error(`${step} locked draft ${draft.id} but updated no row`);

    const submission = await SUBMISSION_WRITES[step]({
      tx,
      draft,
      latest,
      status: next.state.submissionStatus,
      actor,
    });

    await recordAudit(tx, actor, [
      {
        action: STEP_ACTIONS[step],
        entityId: indicatorId,
        changes: {
          ...changesBetween({ status: draft.status, isLocked: draft.isLocked }, version),
          submission,
        },
      },
    ]);

    return { ok: true };
  });
}

async function ciMethodKindOf(tx: Transaction, id: string | null): Promise<CiMethodKind | null> {
  if (id === null) return null;
  const [method] = await tx
    .select({ kind: ciMethod.kind })
    .from(ciMethod)
    .where(eq(ciMethod.id, id));
  return method?.kind ?? null;
}

/**
 * Submits a new indicator's complete draft for approval. `draftUpdatedAt` is the draft's
 * `updatedAt` as the publisher was shown it: an edit since then refuses the submission as
 * `changed`, so nobody confirms a draft they have not seen.
 */
export function submitIndicator(
  db: Database,
  indicatorId: string,
  draftUpdatedAt: Date,
  actor: Actor,
): Promise<IndicatorStepResult<'changed' | 'incomplete'>> {
  return takeIndicatorStep(db, indicatorId, 'submit', actor, {
    precondition: async (tx, { draft }) => {
      if (draft.updatedAt.getTime() !== draftUpdatedAt.getTime()) return 'changed';
      const [lists, ciMethodKind] = await Promise.all([
        draftListsOf(tx, draft.id),
        ciMethodKindOf(tx, draft.ciMethodId),
      ]);
      return isDraftComplete({ ...draft, ...lists, ciMethodKind }) ? undefined : 'incomplete';
    },
  });
}

/**
 * Withdraws the draft's submission before review, unlocking the draft. `submissionNumber` is the
 * submission the publisher was shown: one withdrawn and resubmitted since is refused as `changed`,
 * so an old confirmation page never withdraws a newer submission.
 */
export function withdrawSubmission(
  db: Database,
  indicatorId: string,
  submissionNumber: number,
  actor: Actor,
): Promise<IndicatorStepResult<'changed'>> {
  return takeIndicatorStep(db, indicatorId, 'withdraw', actor, {
    precondition: async (_tx, { latest }) =>
      latest?.number === submissionNumber ? undefined : 'changed',
  });
}
