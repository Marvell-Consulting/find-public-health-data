import { requireApiSession, requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { BlobStorage } from '@fphd/internal-storage';
import { type Request, type Response, Router } from 'express';
import { v7 as uuidv7 } from 'uuid';

import { indicatorIdSchema } from './contract.ts';
import type {
  DataUploadCreated,
  DataUploadError,
  DataUploadLatest,
} from './data-upload-contract.ts';
import { drainRequest, receiveDataTable, UploadAbortedError } from './data-upload-receive.ts';
import type { InternalDataUploadRepository } from './repositories.ts';

/** The indicator's draft version id, having answered the request itself when there is none. */
async function draftIdOrAnswer(
  dataUploads: InternalDataUploadRepository,
  request: Request,
  response: Response,
): Promise<{ indicatorId: string; draftId: string } | undefined> {
  const id = indicatorIdSchema.safeParse(request.params.id);

  if (!id.success) {
    await drainRequest(request);
    response.status(400).json({ error: 'invalid_id' } satisfies DataUploadError);
    return undefined;
  }

  const draftId = await dataUploads.findDraftId(id.data);

  // A published indicator is edited by opening a draft first, so until then there is nothing
  // to upload to.
  if (draftId === undefined || draftId === null) {
    await drainRequest(request);
    response.status(404).json({ error: draftId === null ? 'no_draft' : 'not_found' });
    return undefined;
  }

  return { indicatorId: id.data, draftId };
}

/**
 * The data table upload: the file is streamed to storage as it arrives, then read back, checked
 * and loaded while the publisher waits. Uploading again replaces the draft's data.
 */
export function dataUploadsRouter(
  dataUploads: InternalDataUploadRepository,
  storage: BlobStorage,
  session: JwtSessionVerifier,
): Router {
  const router = Router();
  const requirePublisher = requireJwtRole(session, 'publisher');

  router.post(
    '/api/internal/indicators/:id/data-uploads',
    requirePublisher,
    async (request, response) => {
      const draft = await draftIdOrAnswer(dataUploads, request, response);
      if (draft === undefined) return;

      const { indicatorId } = draft;
      const { sub } = requireApiSession(response);
      const batchId = uuidv7();
      const blobName = `${indicatorId}/${batchId}.csv`;
      const log = { indicatorId, uploadBatchId: batchId };

      const abandoned = new AbortController();
      response.on('close', () => {
        if (!response.writableFinished) abandoned.abort(new UploadAbortedError());
      });

      const deleteBlob = (name: string) =>
        storage
          .delete(name)
          .catch((error: unknown) =>
            request.log.warn({ err: error, blobName: name }, 'Blob not deleted'),
          );

      try {
        const received = await receiveDataTable(request, storage, blobName);

        if (!received.ok) {
          await deleteBlob(blobName);
          response.status(400).json({
            error: 'validation_failed',
            fieldErrors: { dataTable: received.message },
          } satisfies DataUploadError);
          return;
        }

        const { ok: _ok, ...file } = received;
        const result = await dataUploads.process(
          { batchId, indicatorId, blobName, actor: sub, ...file },
          () => storage.get(blobName),
          abandoned.signal,
        );

        if (!result.ok && result.reason === 'no_draft') {
          await deleteBlob(blobName);
          response.status(404).json({ error: 'no_draft' });
          return;
        }

        if (!result.ok) {
          request.log.info(
            { ...log, problems: result.problems.map(({ code }) => code) },
            'Data table refused',
          );
          response.status(422).json({
            error: 'invalid_data_table',
            id: batchId,
            problems: result.problems,
          } satisfies DataUploadError);
          return;
        }

        request.log.info({ ...log, rowCount: result.rowCount }, 'Data table uploaded');
        response
          .status(201)
          .json({ id: batchId, rowCount: result.rowCount } satisfies DataUploadCreated);

        // Only now the new batch is committed: a failure leaves an orphan blob, never a lost one.
        if (result.replacedBlobName !== null) await deleteBlob(result.replacedBlobName);
      } catch (error) {
        await deleteBlob(blobName);
        if (abandoned.signal.aborted || error instanceof UploadAbortedError) {
          request.log.info(log, 'Data table upload abandoned');
          return;
        }
        throw error;
      }
    },
  );

  router.get(
    '/api/internal/indicators/:id/data-uploads/latest',
    requirePublisher,
    async (request, response) => {
      const draft = await draftIdOrAnswer(dataUploads, request, response);
      if (draft === undefined) return;

      const latest = await dataUploads.findLatest(draft.draftId);
      const body: DataUploadLatest = {
        latestUpload:
          latest === undefined ? null : { ...latest, uploadedAt: latest.uploadedAt.toISOString() },
      };

      response.status(200).json(body);
    },
  );

  return router;
}
