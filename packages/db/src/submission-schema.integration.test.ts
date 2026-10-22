import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SYSTEM_USER_IDS } from './schema/index.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

const ACTOR = SYSTEM_USER_IDS.testSeed;

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

let testDb: TestDatabase;
let sql: postgres.Sql;

beforeAll(async () => {
  testDb = await createTestDatabase();
  sql = createOwnerClient(testDb.name);
});

afterAll(async () => {
  await sql.end();
  await testDb.drop();
});

interface Draft {
  indicatorId: string;
  versionId: string;
}

async function newDraft(): Promise<Draft> {
  const [row] = await sql<Draft[]>`
    WITH i AS (INSERT INTO indicator DEFAULT VALUES RETURNING id)
    INSERT INTO indicator_version (indicator_id, name, slug, created_by, updated_by)
    SELECT i.id, 'Submission schema test', 'submission-schema-' || i.id, ${ACTOR}, ${ACTOR} FROM i
    RETURNING indicator_id AS "indicatorId", id AS "versionId"
  `;
  if (!row) throw new Error('inserted no draft');
  return row;
}

type SubmissionValues = {
  number?: number;
  status?: string;
  endedBy?: string | null;
  endedAt?: Date | null;
};

function insertSubmission(
  { indicatorId, versionId }: Draft,
  { number = 1, status = 'submitted', endedBy = null, endedAt = null }: SubmissionValues = {},
) {
  return sql`
    INSERT INTO indicator_version_submission
      (indicator_version_id, indicator_id, number, status, submitted_by, ended_by, ended_at)
    VALUES (${versionId}, ${indicatorId}, ${number}, ${status}, ${ACTOR}, ${endedBy}, ${endedAt})
  `;
}

describe('indicator_version_submission', () => {
  it('starts every version unlocked', async () => {
    const draft = await newDraft();
    const [row] = await sql`SELECT is_locked FROM indicator_version WHERE id = ${draft.versionId}`;

    expect(row).toEqual({ is_locked: false });
  });

  it('records when a submission was made', async () => {
    const draft = await newDraft();
    await insertSubmission(draft);
    const [row] = await sql`
      SELECT submitted_at IS NOT NULL AS dated FROM indicator_version_submission
      WHERE indicator_version_id = ${draft.versionId}
    `;

    expect(row).toEqual({ dated: true });
  });

  it.each([
    ['who ended it', { endedBy: ACTOR }],
    ['when it ended', { endedAt: new Date() }],
    ['both', { endedBy: ACTOR, endedAt: new Date() }],
  ])('refuses %s on a submission still submitted', async (_, ended) => {
    await expect(insertSubmission(await newDraft(), ended)).rejects.toMatchObject({
      code: CHECK_VIOLATION,
    });
  });

  it.each([
    ['nobody', {}],
    ['who ended it alone', { endedBy: ACTOR }],
    ['when it ended alone', { endedAt: new Date() }],
  ])('refuses a withdrawn submission naming %s', async (_, ended) => {
    await expect(
      insertSubmission(await newDraft(), { status: 'withdrawn', ...ended }),
    ).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it('accepts a withdrawn submission saying who ended it and when', async () => {
    await expect(
      insertSubmission(await newDraft(), {
        status: 'withdrawn',
        endedBy: ACTOR,
        endedAt: new Date(),
      }),
    ).resolves.toBeDefined();
  });

  it('refuses a status the workflow does not know', async () => {
    await expect(insertSubmission(await newDraft(), { status: 'approved' })).rejects.toMatchObject({
      code: CHECK_VIOLATION,
    });
  });

  it('numbers submissions from 1', async () => {
    await expect(insertSubmission(await newDraft(), { number: 0 })).rejects.toMatchObject({
      code: CHECK_VIOLATION,
    });
  });

  it('refuses two submissions of one version with the same number', async () => {
    const draft = await newDraft();
    await insertSubmission(draft, { status: 'withdrawn', endedBy: ACTOR, endedAt: new Date() });

    await expect(insertSubmission(draft)).rejects.toMatchObject({ code: UNIQUE_VIOLATION });
  });

  it("refuses a submission naming another indicator's version", async () => {
    const draft = await newDraft();
    const other = await newDraft();

    await expect(
      insertSubmission({ indicatorId: other.indicatorId, versionId: draft.versionId }),
    ).rejects.toMatchObject({ code: FOREIGN_KEY_VIOLATION });
  });

  it('is deleted with its version', async () => {
    const draft = await newDraft();
    await insertSubmission(draft);
    await sql`DELETE FROM indicator_version WHERE id = ${draft.versionId}`;
    const rows = await sql`
      SELECT id FROM indicator_version_submission WHERE indicator_version_id = ${draft.versionId}
    `;

    expect(rows).toEqual([]);
  });
});
