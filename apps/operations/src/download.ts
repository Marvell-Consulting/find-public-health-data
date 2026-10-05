import { createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { setTimeout } from 'node:timers/promises';

export interface DownloadResume {
  attempt: number;
  bytes: number;
  error: unknown;
}

export interface DownloadOptions {
  attempts?: number;
  retryDelayMs?: number;
  onResume?: ((resume: DownloadResume) => void) | undefined;
}

class HttpError extends Error {}

/**
 * Downloads an HTTPS URL to a file. A dropped connection resumes from the bytes already written
 * rather than failing a multi-gigabyte import, and each resumed range is pinned to the ETag the
 * first response served so a replaced object cannot be spliced in. Callers still check the
 * whole file's checksum.
 */
export async function downloadFile(
  url: string,
  path: string,
  label: string,
  { attempts = 5, retryDelayMs = 2_000, onResume }: DownloadOptions = {},
): Promise<void> {
  if (new URL(url).protocol !== 'https:') throw new Error(`${label} URL must use HTTPS`);
  let etag: string | null = null;
  let bytes = 0;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(
        url,
        bytes > 0 && etag ? { headers: { range: `bytes=${bytes}-`, 'if-match': etag } } : {},
      );
      if (new URL(response.url).protocol !== 'https:') {
        throw new HttpError(`${label} download redirected away from HTTPS`);
      }
      if (response.status === 412) throw new HttpError(`${label} changed during download`);
      const resumed =
        response.status === 206 &&
        response.headers.get('content-range')?.startsWith(`bytes ${bytes}-`);
      if ((response.status !== 200 && !resumed) || !response.body) {
        throw new HttpError(`${label} download returned HTTP ${response.status}`);
      }
      if (!resumed) {
        etag = response.headers.get('etag');
        bytes = 0;
      }
      await pipeline(
        response.body,
        createWriteStream(path, resumed ? { flags: 'r+', start: bytes } : { flags: 'w' }),
      );
      return;
    } catch (error) {
      if (error instanceof HttpError || attempt >= attempts) throw error;
      bytes = await stat(path).then(
        (file) => file.size,
        () => 0,
      );
      onResume?.({ attempt, bytes, error });
      await setTimeout(retryDelayMs * attempt);
    }
  }
}
