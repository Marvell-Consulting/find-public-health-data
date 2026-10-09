import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Transform } from 'node:stream';
import { finished } from 'node:stream/promises';

import { Busboy, type BusboyFileStream } from '@fastify/busboy';
import type { BlobStorage } from '@fphd/internal-storage';

import { DATA_TABLE_MAX_BYTES, DATA_TABLE_MESSAGES } from './data-upload-contract.ts';

/** The stored file, or why the form refuses it, in which case nothing is stored. */
export type ReceivedDataTable =
  | { ok: true; originalFilename: string; byteSize: number; sha256: string }
  | { ok: false; message: string };

type Stored = ReceivedDataTable | { ok: 'error'; error: unknown };

const FIELD = 'dataTable';

export class DataTableTooLargeError extends Error {
  constructor() {
    super('The data table is larger than the most accepted');
    this.name = 'DataTableTooLargeError';
  }
}

export class UploadAbortedError extends Error {
  constructor() {
    super('The upload was abandoned before it was received');
    this.name = 'UploadAbortedError';
  }
}

/** Reads what is left of a request, so an answer never races the body still arriving. */
export async function drainRequest(request: IncomingMessage): Promise<void> {
  request.resume();
  await finished(request).catch(() => {});
}

/**
 * Streams the request's data table into storage under `blobName`, hashing and counting it on
 * the way, and answers once the whole request is read. A refused file may be partly or wholly
 * stored, so the caller deletes the blob. An abandoned request rejects with `UploadAbortedError`,
 * and a storage failure with its own error.
 */
export async function receiveDataTable(
  request: IncomingMessage,
  storage: BlobStorage,
  blobName: string,
  maxBytes = DATA_TABLE_MAX_BYTES,
): Promise<ReceivedDataTable> {
  let busboy: ReturnType<typeof Busboy>;
  try {
    busboy = Busboy({
      headers: { ...request.headers, 'content-type': request.headers['content-type'] ?? '' },
      limits: { fileSize: maxBytes, parts: 10 },
    });
  } catch {
    // Not a multipart form at all, so it carries no file.
    await drainRequest(request);
    return { ok: false, message: DATA_TABLE_MESSAGES.missing };
  }

  const result = await new Promise<Stored>((resolve, reject) => {
    let stored: Promise<Stored> | undefined;
    let stopFile: ((error: Error) => void) | undefined;

    busboy.on('file', (field, file, filename) => {
      // A part cut short fails the form as well, which busboy's own error reports.
      file.on('error', (error) => stopFile?.(error));

      if (field !== FIELD || stored !== undefined) {
        file.resume();
        return;
      }

      const refusal =
        filename === ''
          ? DATA_TABLE_MESSAGES.missing
          : /\.csv$/i.test(filename)
            ? undefined
            : DATA_TABLE_MESSAGES.notCsv;

      if (refusal !== undefined) {
        file.resume();
        stored = Promise.resolve({ ok: false, message: refusal });
        return;
      }

      const storing = storeFile(storage, blobName, file, filename);
      stopFile = storing.stop;
      stored = storing.result;
    });

    // The file may still be on its way into storage when the form ends, so this waits for it.
    busboy.on('finish', () => {
      resolve(stored ?? { ok: false, message: DATA_TABLE_MESSAGES.missing });
    });

    // A whole request that is not a well-formed form carries no file the form can use.
    busboy.on('error', (error: unknown) => {
      stopFile?.(new UploadAbortedError());
      if (request.complete) resolve({ ok: false, message: DATA_TABLE_MESSAGES.missing });
      else reject(error);
    });

    request.on('close', () => {
      if (request.complete) return;
      stopFile?.(new UploadAbortedError());
      reject(new UploadAbortedError());
    });

    request.pipe(busboy);
  });

  if (result.ok === 'error') throw result.error;
  return result;
}

function storeFile(
  storage: BlobStorage,
  blobName: string,
  file: BusboyFileStream,
  originalFilename: string,
): { result: Promise<Stored>; stop: (error: Error) => void } {
  const hash = createHash('sha256');
  let byteSize = 0;
  const measured = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      byteSize += chunk.length;
      callback(null, chunk);
    },
  });

  // Destroying the source stops the put before Azure commits anything; the rest is discarded.
  const stop = (error: Error) => {
    file.unpipe(measured);
    measured.destroy(error);
    file.resume();
  };
  file.on('limit', () => stop(new DataTableTooLargeError()));
  file.pipe(measured);

  const result = storage.put(blobName, measured).then(
    (): Stored =>
      byteSize > 0
        ? { ok: true, originalFilename, byteSize, sha256: hash.digest('hex') }
        : { ok: false, message: DATA_TABLE_MESSAGES.empty },
    (error: unknown): Stored => {
      file.resume();
      return error instanceof DataTableTooLargeError
        ? { ok: false, message: DATA_TABLE_MESSAGES.tooLarge }
        : { ok: 'error', error };
    },
  );

  return { result, stop };
}
