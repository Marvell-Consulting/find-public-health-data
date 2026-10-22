import { PassThrough, Readable } from 'node:stream';

import { type Database, schema } from '@fphd/db';
import { eq, sql } from 'drizzle-orm';
import { v7 as randomUuidV7 } from 'uuid';
import { describe, expect } from 'vitest';
import type { IndicatorStep } from './contract.ts';
import { confirmDataTable } from './data-table-check-repository.ts';
import { processDataUpload } from './data-upload-load-repository.ts';
import { updateIndicatorDraft } from './indicator-draft-repository.ts';
import {
  AS_ACTOR,
  AS_OTHER_ACTOR,
  LOCK_WAIT,
  lockWaited,
  lockWaiters,
  newDraft,
  repositoryTest,
} from './indicator-repository.testing.ts';
import { completeDraft, draftUpdatedAt } from './indicator-workflow.testing.ts';
import {
  submitIndicator,
  takeIndicatorStep,
  withdrawSubmission,
} from './indicator-workflow-repository.ts';

const { indicatorVersion, indicatorVersionSubmission } = schema;

const HEADER =
  'area_code,period_start,period_end,value,count,sex,age,category_type,category,value_note';
const VALID_CSV = `${HEADER}\nE92000001,2019-04-01,2020-03-31,83.8,1234,Female,<75 yrs,,,`;
const REFUSED_CSV = `${HEADER}\nE99999999,2019-04-01,2020-03-31,1,,,,,,`;

/**
 * Takes `step` while it holds the draft's lock until `write` has started and is seen waiting
 * on it, then answers what each returned.
 */
async function writeWhileStepHolds<Result>(
  db: Database,
  indicatorId: string,
  step: IndicatorStep,
  write: () => Promise<Result>,
) {
  let held: () => void = () => {};
  let release: () => void = () => {};
  const holding = new Promise<void>((resolve) => {
    held = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stepped = takeIndicatorStep(db, indicatorId, step, AS_ACTOR, {
    precondition: async () => {
      held();
      await released;
      return undefined;
    },
  });
  await holding;
  const written = write();
  try {
    await lockWaited(db);
  } finally {
    release();
  }
  return { step: await stepped, write: await written };
}

/**
 * Runs `write` until it has written the draft's row and waits to record its audit entry, starts
 * `step` waiting behind it, then lets the write commit, and answers what each returned.
 */
async function stepWhileWriteHolds<Written, Stepped>(
  db: Database,
  write: () => Promise<Written>,
  step: () => Promise<Stepped>,
) {
  const { written, stepped } = await db.transaction(async (tx) => {
    // The writes used here update the draft's row before recording their entry, so this holds
    // each with the row written and its transaction open. A timeout rolls this back, freeing it.
    await tx.execute(sql`LOCK TABLE audit_log IN EXCLUSIVE MODE`);
    const written = write();
    await expect.poll(() => lockWaiters(db), LOCK_WAIT).toBe(1);
    const stepped = step();
    await expect.poll(() => lockWaiters(db), LOCK_WAIT).toBe(2);
    return { written, stepped };
  });
  return { write: await written, step: await stepped };
}

/** A new indicator's complete draft, the `updatedAt` its task list shows, and its batch. */
async function completeNewDraft(db: Database, name: string) {
  const created = await newDraft(db, name);
  const shown = await completeDraft(db, created);
  const [row] = await db
    .select({ uploadBatchId: indicatorVersion.uploadBatchId })
    .from(indicatorVersion)
    .where(eq(indicatorVersion.id, created.versionId));
  return { ...created, shown, batchId: row?.uploadBatchId ?? '' };
}

async function submissionCount(db: Database, versionId: string): Promise<number> {
  const rows = await db
    .select({ id: indicatorVersionSubmission.id })
    .from(indicatorVersionSubmission)
    .where(eq(indicatorVersionSubmission.indicatorVersionId, versionId));
  return rows.length;
}

async function draftOf(db: Database, versionId: string) {
  const [row] = await db.select().from(indicatorVersion).where(eq(indicatorVersion.id, versionId));
  if (row === undefined) throw new Error(`no version ${versionId}`);
  return row;
}

/** Loads the file `openFile` opens into the draft. */
function upload(db: Database, indicatorId: string, openFile: () => Promise<Readable>) {
  const batchId = randomUuidV7();
  return processDataUpload(
    db,
    {
      batchId,
      indicatorId,
      blobName: `${indicatorId}/${batchId}.csv`,
      originalFilename: 'data.csv',
      byteSize: 1,
      sha256: '0'.repeat(64),
      actor: AS_OTHER_ACTOR,
    },
    openFile,
    new AbortController().signal,
  );
}

/** Starts loading a file into the draft, holding the file open until `finish` is called. */
async function startUpload(db: Database, indicatorId: string) {
  const file = new PassThrough();
  let opened: () => void = () => {};
  const reading = new Promise<void>((resolve) => {
    opened = resolve;
  });
  const uploaded = upload(db, indicatorId, async () => {
    opened();
    return file;
  });
  await reading;
  return {
    finish: (content: string) => {
      file.end(content);
      return uploaded;
    },
  };
}

describe('a submission beside an edit', () => {
  repositoryTest(
    'is refused as changed when a section save holding the draft commits first',
    async ({ db }) => {
      const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Save then submit');

      const result = await stepWhileWriteHolds(
        db,
        () => updateIndicatorDraft(db, indicatorId, { definition: 'Saved' }, {}, AS_OTHER_ACTOR),
        () => submitIndicator(db, indicatorId, shown, AS_ACTOR),
      );

      expect(result).toEqual({ write: { ok: true }, step: { ok: false, reason: 'changed' } });
      expect((await draftOf(db, versionId)).isLocked).toBe(false);
    },
  );

  repositoryTest(
    'is refused as changed when a data table confirmation holding the draft commits first',
    async ({ db }) => {
      const { indicatorId, versionId, batchId } = await completeNewDraft(db, 'Confirm then submit');
      await db
        .update(indicatorVersion)
        .set({ dataTableConfirmedAt: null })
        .where(eq(indicatorVersion.id, versionId));
      const shown = await draftUpdatedAt(db, versionId);

      const result = await stepWhileWriteHolds(
        db,
        () => confirmDataTable(db, indicatorId, batchId, AS_OTHER_ACTOR),
        () => submitIndicator(db, indicatorId, shown, AS_ACTOR),
      );

      expect(result).toMatchObject({ write: { ok: true }, step: { ok: false, reason: 'changed' } });
      expect((await draftOf(db, versionId)).isLocked).toBe(false);
    },
  );

  repositoryTest('locks out a section save that waited on it', async ({ db }) => {
    const { indicatorId, versionId } = await newDraft(db, 'Save waits on a submission');

    const result = await writeWhileStepHolds(db, indicatorId, 'submit', () =>
      updateIndicatorDraft(db, indicatorId, { definition: 'Too late' }, {}, AS_OTHER_ACTOR),
    );

    expect(result).toEqual({ step: { ok: true }, write: { ok: false, reason: 'locked' } });
    expect((await draftOf(db, versionId)).definition).toBeNull();
  });

  repositoryTest('locks out a data table confirmation that waited on it', async ({ db }) => {
    const { indicatorId, versionId, batchId } = await completeNewDraft(db, 'Confirm waits');
    await db
      .update(indicatorVersion)
      .set({ dataTableConfirmedAt: null })
      .where(eq(indicatorVersion.id, versionId));

    const result = await writeWhileStepHolds(db, indicatorId, 'submit', () =>
      confirmDataTable(db, indicatorId, batchId, AS_OTHER_ACTOR),
    );

    expect(result).toEqual({ step: { ok: true }, write: { ok: false, reason: 'locked' } });
    expect((await draftOf(db, versionId)).dataTableConfirmedAt).toBeNull();
  });

  repositoryTest('lets a section save that waited on a withdrawal through', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(
      db,
      'Save waits on a withdrawal',
    );
    await submitIndicator(db, indicatorId, shown, AS_ACTOR);

    const result = await writeWhileStepHolds(db, indicatorId, 'withdraw', () =>
      updateIndicatorDraft(db, indicatorId, { definition: 'After withdrawal' }, {}, AS_OTHER_ACTOR),
    );

    expect(result).toEqual({ step: { ok: true }, write: { ok: true } });
    expect((await draftOf(db, versionId)).definition).toBe('After withdrawal');
  });
});

describe('two steps at once', () => {
  repositoryTest('refuse the second of two submissions', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Submitted together');

    const result = await writeWhileStepHolds(db, indicatorId, 'submit', () =>
      submitIndicator(db, indicatorId, shown, AS_OTHER_ACTOR),
    );

    expect(result).toEqual({ step: { ok: true }, write: { ok: false, reason: 'not_allowed' } });
    expect(await submissionCount(db, versionId)).toBe(1);
  });

  repositoryTest('refuse the second of two withdrawals', async ({ db }) => {
    const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Withdrawn together');
    await submitIndicator(db, indicatorId, shown, AS_ACTOR);

    const result = await writeWhileStepHolds(db, indicatorId, 'withdraw', () =>
      withdrawSubmission(db, indicatorId, 1, AS_OTHER_ACTOR),
    );

    expect(result).toEqual({ step: { ok: true }, write: { ok: false, reason: 'not_allowed' } });
    expect(await submissionCount(db, versionId)).toBe(1);
    expect((await draftOf(db, versionId)).isLocked).toBe(false);
  });
});

describe('a submission beside an upload', () => {
  repositoryTest(
    'is refused as changed after a load, and as incomplete once the publisher sees it',
    async ({ db }) => {
      const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Loaded first');
      const loading = await startUpload(db, indicatorId);
      expect(await loading.finish(VALID_CSV)).toMatchObject({ ok: true });

      await expect(submitIndicator(db, indicatorId, shown, AS_ACTOR)).resolves.toEqual({
        ok: false,
        reason: 'changed',
      });
      await expect(
        submitIndicator(db, indicatorId, await draftUpdatedAt(db, versionId), AS_ACTOR),
      ).resolves.toEqual({ ok: false, reason: 'incomplete' });
    },
  );

  repositoryTest(
    "is refused as changed when it waits on an upload's final write",
    async ({ db }) => {
      const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Load then submit');

      const result = await stepWhileWriteHolds(
        db,
        () => upload(db, indicatorId, async () => Readable.from([VALID_CSV])),
        () => submitIndicator(db, indicatorId, shown, AS_ACTOR),
      );

      expect(result).toMatchObject({ write: { ok: true }, step: { ok: false, reason: 'changed' } });
      expect((await draftOf(db, versionId)).isLocked).toBe(false);
    },
  );

  repositoryTest.for([
    ['loads', VALID_CSV],
    ['is refused', REFUSED_CSV],
  ] as const)(
    'goes through while a file that %s is loading, which then keeps nothing',
    async ([outcome, content], { db }) => {
      const { indicatorId, versionId, shown, batchId } = await completeNewDraft(
        db,
        `Submitted while a file ${outcome}`,
      );
      const loading = await startUpload(db, indicatorId);

      await expect(submitIndicator(db, indicatorId, shown, AS_ACTOR)).resolves.toEqual({
        ok: true,
      });

      expect(await loading.finish(content)).toMatchObject({ ok: false, reason: 'locked' });
      const draft = await draftOf(db, versionId);
      expect(draft).toMatchObject({ isLocked: true, uploadBatchId: batchId });
      expect(draft.dataTableConfirmedAt).not.toBeNull();
    },
  );

  repositoryTest.for([
    ['loads', VALID_CSV],
    ['is refused', REFUSED_CSV],
  ] as const)(
    'refuses a file that %s as locked while the submission is being withdrawn',
    async ([outcome, content], { db }) => {
      const { indicatorId, versionId, shown, batchId } = await completeNewDraft(
        db,
        `Withdrawn while a file ${outcome}`,
      );
      const loading = await startUpload(db, indicatorId);
      await submitIndicator(db, indicatorId, shown, AS_ACTOR);
      let held: () => void = () => {};
      let release: () => void = () => {};
      const holding = new Promise<void>((resolve) => {
        held = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const withdrawn = takeIndicatorStep(db, indicatorId, 'withdraw', AS_ACTOR, {
        precondition: async () => {
          held();
          await released;
          return undefined;
        },
      });
      await holding;

      // The withdrawal holds the row, uncommitted, so the load finds it locked without waiting.
      const loaded = await Promise.race([
        loading.finish(content),
        new Promise((resolve) => setTimeout(() => resolve('blocked'), LOCK_WAIT.timeout)),
      ]).finally(release);

      expect(loaded).toMatchObject({ ok: false, reason: 'locked' });
      expect(await withdrawn).toEqual({ ok: true });
      expect(await draftOf(db, versionId)).toMatchObject({
        isLocked: false,
        uploadBatchId: batchId,
      });
    },
  );

  repositoryTest('refuses a file loaded after it as locked', async ({ db }) => {
    const { indicatorId, versionId, shown, batchId } = await completeNewDraft(
      db,
      'Submit then load',
    );
    await submitIndicator(db, indicatorId, shown, AS_ACTOR);

    await expect(
      upload(db, indicatorId, async () => Readable.from([VALID_CSV])),
    ).resolves.toMatchObject({ ok: false, reason: 'locked' });
    expect(await draftOf(db, versionId)).toMatchObject({ isLocked: true, uploadBatchId: batchId });
  });
});
