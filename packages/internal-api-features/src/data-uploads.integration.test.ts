import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { fileURLToPath } from 'node:url';

import { BlobServiceClient } from '@azure/storage-blob';
import { appEnvFields, parseEnv, z } from '@fphd/config';
import { createDb, type Database, dbEnvFields, dimensionKey, resolveDbTls, schema } from '@fphd/db';
import { createTestDatabase } from '@fphd/db/testing';
import { request } from '@fphd/express/testing';
import { BlobNotFoundError, createAzureBlobStorage } from '@fphd/internal-storage';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { processDataUpload } from './data-upload-load-repository.ts';
import { dataUploadsRouter } from './data-uploads.ts';
import { createDraftFromPublished } from './indicator-publish-repository.ts';
import { ACTOR, newDraft } from './indicator-repository.testing.ts';
import { createInternalRepositories } from './repositories.ts';
import { createRouterTestApp, testSessionCookie, testSessionVerifier } from './testing.ts';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
    INTERNAL_API_PASSWORD: z.string().default('internal_api'),
    STORAGE_CONNECTION_STRING: z.string(),
  }),
  process.env,
);

const {
  indicatorVersion,
  observation,
  observationDimension,
  observationNote,
  uploadBatch,
  currentPublishedVersion,
} = schema;

const testDb = await createTestDatabase({ template: 'seeded' });
const connection = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: testDb.name,
  ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
};
// The uploads run as internal_api, so its grants are tested too; the checks read as the owner.
const internalDb = createDb({
  ...connection,
  user: 'internal_api',
  password: env.INTERNAL_API_PASSWORD,
});
const ownerDb = createDb({
  ...connection,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
});

const container = `fphd-test-${randomBytes(6).toString('hex')}`;
const storage = await createAzureBlobStorage({
  container,
  connectionString: env.STORAGE_CONNECTION_STRING,
});

const app = createRouterTestApp(
  dataUploadsRouter(
    createInternalRepositories(internalDb).dataUploads,
    storage,
    testSessionVerifier,
  ),
);

afterAll(async () => {
  await internalDb.$client.end();
  await ownerDb.$client.end();
  await testDb.drop();
  await BlobServiceClient.fromConnectionString(env.STORAGE_CONNECTION_STRING).deleteContainer(
    container,
  );
});

const HEADER =
  'area_code,period_start,period_end,value,count,sex,age,category_type,category,value_note';
const VALID_CSV = [
  HEADER,
  'E92000001,2019-04-01,2020-03-31,83.8,1234,Female,<75 yrs,,,',
  'E92000001,2019-04-01,2020-03-31,83.1,1200,Persons,All ages,,,',
  'E08000035,2019-04-01,2020-03-31,,,,,Ethnic groups [4],White,Aggregated from values for merged CCGs',
].join('\n');

async function upload(indicatorId: string, content: string, filename = 'data.csv') {
  return request(app)
    .post(`/api/internal/indicators/${indicatorId}/data-uploads`)
    .set('Cookie', await testSessionCookie(['internal', 'publisher']))
    .attach('dataTable', Buffer.from(content), filename);
}

async function draftOf(db: Database, indicatorId: string) {
  const [draft] = await db
    .select()
    .from(indicatorVersion)
    .where(
      and(eq(indicatorVersion.indicatorId, indicatorId), eq(indicatorVersion.status, 'draft')),
    );
  if (draft === undefined) throw new Error(`indicator ${indicatorId} has no draft`);
  return draft;
}

async function batchOf(batchId: string) {
  const [batch] = await ownerDb.select().from(uploadBatch).where(eq(uploadBatch.id, batchId));
  return batch;
}

async function rowsOf(batchId: string) {
  return ownerDb
    .select()
    .from(observation)
    .where(eq(observation.uploadBatchId, batchId))
    .orderBy(asc(observation.value));
}

/** Published indicators with no draft open, the nth of them, so each test takes its own. */
async function publishedWithoutDraft(nth: number): Promise<string> {
  const rows = await ownerDb
    .select({ indicatorId: currentPublishedVersion.indicatorId })
    .from(currentPublishedVersion)
    .leftJoin(
      indicatorVersion,
      and(
        eq(indicatorVersion.indicatorId, currentPublishedVersion.indicatorId),
        eq(indicatorVersion.status, 'draft'),
      ),
    )
    .where(sql`${indicatorVersion.id} IS NULL`)
    .orderBy(asc(currentPublishedVersion.indicatorId));
  const row = rows[nth];
  if (row === undefined)
    throw new Error(`the seed has no published indicator ${nth} without a draft`);
  return row.indicatorId;
}

async function blobExists(name: string): Promise<boolean> {
  try {
    await text(await storage.get(name));
    return true;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return false;
    throw error;
  }
}

describe('POST /api/internal/indicators/:id/data-uploads', () => {
  it('stores the file, loads its rows into a batch and points the draft at it', async () => {
    const { indicatorId } = await newDraft(internalDb, 'Upload loads rows');

    const response = await upload(indicatorId, VALID_CSV, 'life.csv');

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), rowCount: 3 });
    const batchId: string = response.body.id;

    expect(await batchOf(batchId)).toMatchObject({
      indicatorId,
      status: 'processed',
      originalFilename: 'life.csv',
      uploadedBy: 'test-user',
      blobName: `${indicatorId}/${batchId}.csv`,
      byteSize: Buffer.byteLength(VALID_CSV),
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      rowCount: 3,
      columnNames: HEADER.split(','),
      validationResult: null,
      kind: 'replace',
      baseBatchId: null,
    });
    expect(await text(await storage.get(`${indicatorId}/${batchId}.csv`))).toBe(VALID_CSV);
    expect(await draftOf(ownerDb, indicatorId)).toMatchObject({
      uploadBatchId: batchId,
      dataTableConfirmedAt: null,
      updatedBy: 'test-user',
    });

    const rows = await rowsOf(batchId);
    expect(rows.map(({ value, count, createdBy }) => ({ value, count, createdBy }))).toEqual([
      { value: 83.1, count: 1200, createdBy: 'test-user' },
      { value: 83.8, count: 1234, createdBy: 'test-user' },
      { value: null, count: null, createdBy: 'test-user' },
    ]);
  });

  it('stores totals without the dimension and keys each row by its dimension values', async () => {
    const { indicatorId } = await newDraft(internalDb, 'Upload stores totals');

    const response = await upload(indicatorId, VALID_CSV);
    const rows = await rowsOf(response.body.id);
    const dimensions = await ownerDb
      .select()
      .from(observationDimension)
      .where(
        inArray(
          observationDimension.observationId,
          rows.map(({ id }) => id),
        ),
      );
    const notes = await ownerDb
      .select()
      .from(observationNote)
      .where(
        inArray(
          observationNote.observationId,
          rows.map(({ id }) => id),
        ),
      );

    const [total, female, white] = [rows[0], rows[1], rows[2]];
    const valuesOf = (id: string | undefined) =>
      dimensions.filter((row) => row.observationId === id).map((row) => row.dimensionValueId);

    expect(valuesOf(total?.id)).toEqual([]);
    expect(total?.dimensionKey).toBe('');
    expect(valuesOf(female?.id)).toHaveLength(2);
    expect(female?.dimensionKey).toBe(dimensionKey(valuesOf(female?.id)));
    expect(valuesOf(white?.id)).toHaveLength(1);
    expect(notes.map(({ observationId }) => observationId)).toEqual([white?.id]);
  });

  it("keeps a draft's rows out of the published views", async () => {
    const { indicatorId } = await newDraft(internalDb, 'Upload stays unpublished');

    await upload(indicatorId, VALID_CSV);

    const published = await ownerDb.execute(
      sql`SELECT count(*)::int AS n FROM published.observation WHERE indicator_id = ${indicatorId}`,
    );
    expect(published[0]).toEqual({ n: 0 });
  });

  it('keeps a refused file and its failed batch, loading nothing and leaving the draft alone', async () => {
    const { indicatorId } = await newDraft(internalDb, 'Upload refused');
    const first = await upload(indicatorId, VALID_CSV);

    const response = await upload(
      indicatorId,
      [
        HEADER,
        'E99999999,2019-04-01,2020-03-31,1,,,,,,',
        'E92000001,2019-04-01,2020-03-31,lots,,,,,,',
        'E92000001,2020-04-01,2021-03-31,1,,,,,,',
        'E92000001,2020-04-01,2021-03-31,2,,Persons,,,,',
      ].join('\n'),
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: 'invalid_data_table',
      id: expect.any(String),
      problems: [
        { code: 'unmatched_area_codes', items: ['E99999999'], count: 1 },
        { code: 'invalid_numbers', items: ['3'], count: 1 },
        { code: 'duplicate_rows', items: ['5'], count: 1 },
      ],
    });
    const failedId: string = response.body.id;
    expect(await batchOf(failedId)).toMatchObject({
      status: 'failed',
      validationResult: response.body.problems,
      rowCount: null,
      columnNames: HEADER.split(','),
    });
    expect(await rowsOf(failedId)).toEqual([]);
    expect(await blobExists(`${indicatorId}/${failedId}.csv`)).toBe(true);
    expect((await draftOf(ownerDb, indicatorId)).uploadBatchId).toBe(first.body.id);
    expect(await rowsOf(first.body.id)).toHaveLength(3);
  });

  it('replaces the draft batch on a second upload, deleting its rows, its row and its file', async () => {
    const { indicatorId } = await newDraft(internalDb, 'Upload replaces');
    const first = await upload(indicatorId, VALID_CSV);
    const firstBlob = `${indicatorId}/${first.body.id}.csv`;

    const second = await upload(indicatorId, `${HEADER}\nE12000001,2021-04-01,2022-03-31,7,,,,,,`);

    expect(second.status).toBe(201);
    expect((await draftOf(ownerDb, indicatorId)).uploadBatchId).toBe(second.body.id);
    expect(await batchOf(first.body.id)).toBeUndefined();
    expect(await rowsOf(first.body.id)).toEqual([]);
    await expect.poll(() => blobExists(firstBlob)).toBe(false);
    expect(await rowsOf(second.body.id)).toHaveLength(1);
  });

  it('clears the confirmation when a confirmed table is replaced', async () => {
    const { indicatorId, versionId } = await newDraft(internalDb, 'Upload clears confirmation');
    const first = await upload(indicatorId, VALID_CSV);
    await ownerDb
      .update(indicatorVersion)
      .set({ dataTableConfirmedAt: sql`now()` })
      .where(eq(indicatorVersion.id, versionId));

    await upload(indicatorId, VALID_CSV);

    expect(first.status).toBe(201);
    expect((await draftOf(ownerDb, indicatorId)).dataTableConfirmedAt).toBeNull();
  });

  it('leaves the published rows unchanged when an update draft uploads', async () => {
    const indicatorId = await publishedWithoutDraft(0);
    const publishedRows = sql`
      SELECT id, area_id, from_date, to_date, value FROM published.observation
      WHERE indicator_id = ${indicatorId} ORDER BY id`;
    const before = await ownerDb.execute(publishedRows);
    expect(before.length).toBeGreaterThan(0);
    const draftResult = await createDraftFromPublished(internalDb, indicatorId, ACTOR);
    if (!draftResult.ok) throw new Error('expected an update draft');
    const publishedBatchId = (await draftOf(ownerDb, indicatorId)).uploadBatchId;
    if (publishedBatchId === null) throw new Error('the update draft copied no batch');

    const response = await upload(indicatorId, VALID_CSV);

    expect(response.status).toBe(201);
    expect(await ownerDb.execute(publishedRows)).toEqual(before);
    expect(await batchOf(publishedBatchId)).toMatchObject({ status: 'processed' });
    expect((await draftOf(ownerDb, indicatorId)).uploadBatchId).toBe(response.body.id);
  });

  it('queues concurrent uploads to one draft, the later replacing the earlier', async () => {
    const { indicatorId, versionId } = await newDraft(internalDb, 'Upload concurrently');

    const responses = await Promise.all([
      upload(indicatorId, VALID_CSV),
      upload(indicatorId, VALID_CSV),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    const batches = await ownerDb
      .select({ id: uploadBatch.id })
      .from(uploadBatch)
      .where(eq(uploadBatch.indicatorVersionId, versionId));
    expect(batches).toHaveLength(1);
    expect((await draftOf(ownerDb, indicatorId)).uploadBatchId).toBe(batches[0]?.id);
  });

  it('answers 404 for an indicator with no draft', async () => {
    const response = await upload(await publishedWithoutDraft(1), VALID_CSV);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'no_draft' });
  });
});

describe('GET /api/internal/indicators/:id/data-uploads/latest', () => {
  it('answers the failed upload until a later upload loads', async () => {
    const { indicatorId } = await newDraft(internalDb, 'Upload latest');
    const latest = async () =>
      (
        await request(app)
          .get(`/api/internal/indicators/${indicatorId}/data-uploads/latest`)
          .set('Cookie', await testSessionCookie(['internal', 'publisher']))
      ).body;

    expect(await latest()).toEqual({ latestUpload: null });

    const refused = await upload(indicatorId, 'area_code\nE92000001', 'short.csv');
    expect(await latest()).toEqual({
      latestUpload: {
        id: refused.body.id,
        status: 'failed',
        originalFilename: 'short.csv',
        uploadedAt: expect.any(String),
        problems: refused.body.problems,
      },
    });

    const loaded = await upload(indicatorId, VALID_CSV);
    expect(await latest()).toMatchObject({
      latestUpload: { id: loaded.body.id, status: 'processed', problems: [] },
    });
  });
});

describe('processDataUpload', () => {
  it('rolls back, recording nothing, when the upload is abandoned', async () => {
    const { indicatorId } = await newDraft(internalDb, 'Upload abandoned');
    const batchId = '019fa38f-073f-764e-9ac6-1c4d03b1ffff';
    const blobName = `${indicatorId}/${batchId}.csv`;
    await storage.put(blobName, Readable.from([VALID_CSV]));

    await expect(
      processDataUpload(
        internalDb,
        {
          batchId,
          indicatorId,
          blobName,
          originalFilename: 'data.csv',
          byteSize: 1,
          sha256: '0'.repeat(64),
          actor: ACTOR,
        },
        () => storage.get(blobName),
        AbortSignal.abort(),
      ),
    ).rejects.toThrow();

    expect(await batchOf(batchId)).toBeUndefined();
    expect((await draftOf(ownerDb, indicatorId)).uploadBatchId).toBeNull();
  });
});
