import { PassThrough } from 'node:stream';

import { type Database, schema } from '@fphd/db';
import { eq, sql } from 'drizzle-orm';
import { v7 as randomUuidV7 } from 'uuid';
import { describe, expect } from 'vitest';

import { confirmDataTable } from './data-table-check-repository.ts';
import { processDataUpload } from './data-upload-load-repository.ts';
import { updateIndicatorDraft } from './indicator-draft-repository.ts';
import {
  AS_ACTOR,
  AS_OTHER_ACTOR,
  lockWaited,
  newDraft,
  repositoryTest,
} from './indicator-repository.testing.ts';
import { completeDraft, draftUpdatedAt } from './indicator-workflow.testing.ts';
import type { IndicatorStep } from './indicator-workflow.ts';
import { submitIndicator, takeIndicatorStep } from './indicator-workflow-repository.ts';

const { indicatorVersion } = schema;

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
  await lockWaited(db);
  release();
  return { step: await stepped, write: await written };
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

async function draftOf(db: Database, versionId: string) {
  const [row] = await db.select().from(indicatorVersion).where(eq(indicatorVersion.id, versionId));
  if (row === undefined) throw new Error(`no version ${versionId}`);
  return row;
}

/** Starts loading a file into the draft, holding the file open until `finish` is called. */
async function startUpload(db: Database, indicatorId: string) {
  const file = new PassThrough();
  let opened: () => void = () => {};
  const reading = new Promise<void>((resolve) => {
    opened = resolve;
  });
  const batchId = randomUuidV7();
  const uploaded = processDataUpload(
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
    async () => {
      opened();
      return file;
    },
    new AbortController().signal,
  );
  await reading;
  return {
    batchId,
    finish: (content: string) => {
      file.end(content);
      return uploaded;
    },
  };
}

describe('a submission beside an edit', () => {
  repositoryTest(
    'is refused as changed when a save holding the draft commits first',
    async ({ db }) => {
      const { indicatorId, versionId, shown } = await completeNewDraft(
        db,
        'Saved while submitting',
      );

      const { waiting } = await db.transaction(async (tx) => {
        await tx
          .update(indicatorVersion)
          .set({ definition: 'Saved meanwhile', updatedAt: sql`now()` })
          .where(eq(indicatorVersion.id, versionId));
        const waiting = submitIndicator(db, indicatorId, shown, AS_ACTOR);
        await lockWaited(db);
        return { waiting };
      });

      expect(await waiting).toEqual({ ok: false, reason: 'changed' });
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

describe('a submission beside an upload', () => {
  repositoryTest(
    'is refused as changed after a load, and as incomplete once the publisher sees it',
    async ({ db }) => {
      const { indicatorId, versionId, shown } = await completeNewDraft(db, 'Loaded first');
      const upload = await startUpload(db, indicatorId);
      expect(await upload.finish(VALID_CSV)).toMatchObject({ ok: true });

      await expect(submitIndicator(db, indicatorId, shown, AS_ACTOR)).resolves.toEqual({
        ok: false,
        reason: 'changed',
      });
      await expect(
        submitIndicator(db, indicatorId, await draftUpdatedAt(db, versionId), AS_ACTOR),
      ).resolves.toEqual({ ok: false, reason: 'incomplete' });
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
      const upload = await startUpload(db, indicatorId);

      await expect(submitIndicator(db, indicatorId, shown, AS_ACTOR)).resolves.toEqual({
        ok: true,
      });

      expect(await upload.finish(content)).toMatchObject({ ok: false, reason: 'no_draft' });
      const draft = await draftOf(db, versionId);
      expect(draft).toMatchObject({ isLocked: true, uploadBatchId: batchId });
      expect(draft.dataTableConfirmedAt).not.toBeNull();
    },
  );
});
