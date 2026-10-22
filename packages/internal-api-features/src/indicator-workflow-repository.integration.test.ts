import { type Database, schema } from '@fphd/db';
import { auditEntriesFor } from '@fphd/db/testing';
import { asc, eq, sql } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { getIndicatorDraftState, updateIndicatorDraft } from './indicator-draft-repository.ts';
import { createDraftFromPublished } from './indicator-publish-repository.ts';
import {
  ACTOR,
  AS_ACTOR,
  AS_OTHER_ACTOR,
  indicatorWithTwoPublications,
  newDraft,
  OTHER_ACTOR,
  repositoryTest,
} from './indicator-repository.testing.ts';
import { indicatorTaskList } from './indicator-task-list.ts';
import { completeDraft, draftUpdatedAt } from './indicator-workflow.testing.ts';
import { submitIndicator, withdrawSubmission } from './indicator-workflow-repository.ts';

const { indicatorVersion, indicatorVersionSubmission } = schema;

const STEP_ACTIONS = ['indicator.submitted', 'indicator.submission_withdrawn'];

async function versionOf(db: Database, versionId: string) {
  const [row] = await db
    .select({
      status: indicatorVersion.status,
      isLocked: indicatorVersion.isLocked,
      updatedAt: indicatorVersion.updatedAt,
      updatedBy: indicatorVersion.updatedBy,
    })
    .from(indicatorVersion)
    .where(eq(indicatorVersion.id, versionId));
  if (row === undefined) throw new Error(`no version ${versionId}`);
  return row;
}

function submissionsOf(db: Database, versionId: string) {
  return db
    .select()
    .from(indicatorVersionSubmission)
    .where(eq(indicatorVersionSubmission.indicatorVersionId, versionId))
    .orderBy(asc(indicatorVersionSubmission.number));
}

async function stepEntriesFor(db: Database, indicatorId: string) {
  const entries = await auditEntriesFor(db, indicatorId);
  return entries.filter(({ action }) => STEP_ACTIONS.includes(action));
}

/**
 * Versions whose lock disagrees with their latest submission: a version is locked exactly when
 * it is unpublished and its latest submission is one under review or approved.
 */
async function lockMismatches(db: Database): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT v.id FROM indicator_version v
    LEFT JOIN LATERAL (
      SELECT status FROM indicator_version_submission s
      WHERE s.indicator_version_id = v.id ORDER BY s.number DESC LIMIT 1
    ) latest ON true
    WHERE v.is_locked IS DISTINCT FROM
      (v.status <> 'published' AND coalesce(latest.status IN ('submitted'), false))
  `)) as unknown as { id: string }[];
  return rows.map(({ id }) => id);
}

/** A row as the audit log holds it, its dates as text. */
function asJson(row: unknown): unknown {
  return JSON.parse(JSON.stringify(row));
}

/** A new indicator's complete draft and the `updatedAt` its task list would show. */
async function completeNewDraft(db: Database, name: string) {
  const created = await newDraft(db, name);
  const shown = await completeDraft(db, created);
  return { ...created, shown };
}

describe('completeDraft', () => {
  repositoryTest('leaves a draft the task list lets the publisher submit', async ({ db }) => {
    const { indicatorId } = await completeNewDraft(db, 'Completed for submission');
    const state = await getIndicatorDraftState(db, indicatorId);
    if (!state?.draft) throw new Error('expected a draft');

    const { draft, draftCiMethodKind, ...indicator } = state;
    expect(
      indicatorTaskList({ indicator, draft: { ...draft, ciMethodKind: draftCiMethodKind } })
        .canSubmit,
    ).toBe(true);
  });
});

describe('submitIndicator', () => {
  repositoryTest('locks a complete draft under its first submission', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Submitted once');

    await expect(submitIndicator(db, indicatorId, shown, AS_ACTOR)).resolves.toEqual({ ok: true });

    expect((await versionOf(db, versionId)).isLocked).toBe(true);
    expect(await submissionsOf(db, versionId)).toEqual([
      expect.objectContaining({
        indicatorId,
        number: 1,
        status: 'submitted',
        submittedBy: ACTOR,
        submittedAt: expect.any(Date),
        endedBy: null,
        endedAt: null,
      }),
    ]);
  });

  repositoryTest('records the lock and the new submission in one audit entry', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Submission audited');

    await submitIndicator(db, indicatorId, shown, AS_OTHER_ACTOR);

    const [submission] = await submissionsOf(db, versionId);
    expect(await stepEntriesFor(db, indicatorId)).toEqual([
      {
        actorId: OTHER_ACTOR,
        action: 'indicator.submitted',
        entityType: 'indicator',
        requestId: null,
        changes: {
          isLocked: { before: false, after: true },
          submission: {
            before: null,
            after: asJson(submission),
          },
        },
      },
    ]);
  });

  repositoryTest('leaves the status and the last edit as they were', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Submitted unedited');
    const before = await versionOf(db, versionId);

    await submitIndicator(db, indicatorId, shown, AS_OTHER_ACTOR);

    expect(await versionOf(db, versionId)).toEqual({ ...before, isLocked: true });
  });

  repositoryTest('refuses an incomplete draft and writes nothing', async ({ db }) => {
    const { indicatorId, versionId } = await newDraft(db, 'Submitted incomplete');

    await expect(
      submitIndicator(db, indicatorId, await draftUpdatedAt(db, versionId), AS_ACTOR),
    ).resolves.toEqual({ ok: false, reason: 'incomplete' });

    expect((await versionOf(db, versionId)).isLocked).toBe(false);
    expect(await submissionsOf(db, versionId)).toEqual([]);
    expect(await stepEntriesFor(db, indicatorId)).toEqual([]);
  });

  repositoryTest('refuses a draft edited since the publisher was shown it', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Edited before submit');
    await updateIndicatorDraft(db, indicatorId, { definition: 'Edited since' }, {}, AS_ACTOR);

    await expect(submitIndicator(db, indicatorId, shown, AS_ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'changed',
    });

    expect((await versionOf(db, versionId)).isLocked).toBe(false);
    expect(await submissionsOf(db, versionId)).toEqual([]);
  });

  repositoryTest(
    'numbers a resubmission after a withdrawal, which leaves the draft as shown',
    async ({ db }) => {
      const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Submitted twice');
      await submitIndicator(db, indicatorId, shown, AS_ACTOR);
      await withdrawSubmission(db, indicatorId, AS_ACTOR);

      await expect(submitIndicator(db, indicatorId, shown, AS_ACTOR)).resolves.toEqual({
        ok: true,
      });

      expect(
        (await submissionsOf(db, versionId)).map(({ number, status }) => [number, status]),
      ).toEqual([
        [1, 'withdrawn'],
        [2, 'submitted'],
      ]);
    },
  );

  repositoryTest('refuses a draft already submitted', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Submitted again');
    await submitIndicator(db, indicatorId, shown, AS_ACTOR);

    await expect(submitIndicator(db, indicatorId, shown, AS_ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'not_allowed',
    });
    expect(await submissionsOf(db, versionId)).toHaveLength(1);
  });

  repositoryTest('refuses the draft of a live indicator', async ({ db }) => {
    const { indicatorId } = await indicatorWithTwoPublications(db, 'Live when submitted');
    const drafted = await createDraftFromPublished(db, indicatorId, AS_ACTOR);
    if (!drafted.ok) throw new Error('expected a draft');

    await expect(
      submitIndicator(db, indicatorId, await draftUpdatedAt(db, drafted.versionId), AS_ACTOR),
    ).resolves.toEqual({ ok: false, reason: 'not_allowed' });
    expect(await submissionsOf(db, drafted.versionId)).toEqual([]);
  });

  repositoryTest('refuses an indicator with no draft', async ({ db }) => {
    const { indicatorId } = await indicatorWithTwoPublications(db, 'Nothing to submit');

    await expect(submitIndicator(db, indicatorId, new Date(), AS_ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'no_draft',
    });
  });
});

describe('withdrawSubmission', () => {
  repositoryTest('unlocks the draft and ends its submission', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Withdrawn');
    await submitIndicator(db, indicatorId, shown, AS_ACTOR);
    const before = await versionOf(db, versionId);

    await expect(withdrawSubmission(db, indicatorId, AS_OTHER_ACTOR)).resolves.toEqual({
      ok: true,
    });

    expect(await versionOf(db, versionId)).toEqual({ ...before, isLocked: false });
    expect(await submissionsOf(db, versionId)).toEqual([
      expect.objectContaining({
        number: 1,
        status: 'withdrawn',
        submittedBy: ACTOR,
        endedBy: OTHER_ACTOR,
        endedAt: expect.any(Date),
      }),
    ]);
  });

  repositoryTest(
    'records the unlock and the ended submission in one audit entry',
    async ({ db }) => {
      const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Withdrawal audited');
      await submitIndicator(db, indicatorId, shown, AS_ACTOR);
      const [submitted] = await submissionsOf(db, versionId);

      await withdrawSubmission(db, indicatorId, AS_OTHER_ACTOR);

      const [withdrawn] = await submissionsOf(db, versionId);
      const [, entry] = await stepEntriesFor(db, indicatorId);
      expect(entry).toEqual({
        actorId: OTHER_ACTOR,
        action: 'indicator.submission_withdrawn',
        entityType: 'indicator',
        requestId: null,
        changes: {
          isLocked: { before: true, after: false },
          submission: { before: asJson(submitted), after: asJson(withdrawn) },
        },
      });
    },
  );

  repositoryTest('refuses a draft never submitted', async ({ db }) => {
    const { indicatorId } = await newDraft(db, 'Withdrawn unsubmitted');

    await expect(withdrawSubmission(db, indicatorId, AS_ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'not_allowed',
    });
  });

  repositoryTest('refuses a submission already withdrawn', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Withdrawn twice');
    await submitIndicator(db, indicatorId, shown, AS_ACTOR);
    await withdrawSubmission(db, indicatorId, AS_ACTOR);

    await expect(withdrawSubmission(db, indicatorId, AS_ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'not_allowed',
    });
    expect(await stepEntriesFor(db, indicatorId)).toHaveLength(2);
    expect((await submissionsOf(db, versionId))[0]?.status).toBe('withdrawn');
  });
});

describe('the lock', () => {
  repositoryTest('matches the latest submission after every step', async ({ db }) => {
    const { indicatorId, shown } = await completeNewDraft(db, 'Locked in step');
    const steps = [
      () => submitIndicator(db, indicatorId, shown, AS_ACTOR),
      () => withdrawSubmission(db, indicatorId, AS_ACTOR),
      () => submitIndicator(db, indicatorId, shown, AS_ACTOR),
      () => withdrawSubmission(db, indicatorId, AS_ACTOR),
    ];

    for (const step of steps) {
      expect(await step()).toEqual({ ok: true });
      expect(await lockMismatches(db)).toEqual([]);
    }
  });
});
