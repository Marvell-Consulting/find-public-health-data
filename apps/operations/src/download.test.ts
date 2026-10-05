import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type DownloadResume, downloadFile } from './download.ts';

const url = 'https://example.test/package.tar';
const contents = new TextEncoder().encode('0123456789abcdefghij');
let directory: string;

function response(
  body: ConstructorParameters<typeof Response>[0],
  { status = 200, headers = {} }: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const value = new Response(body, { status, headers });
  Object.defineProperty(value, 'url', { value: url });
  return value;
}

/** A body that delivers its bytes and then drops, as a reset connection does. */
function dropsAfter(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let sent = false;
  return new ReadableStream({
    async pull(controller) {
      if (sent) {
        // Lets the delivered bytes reach the file first, as they would over a real connection.
        await setTimeout(20);
        controller.error(new TypeError('terminated'));
      } else {
        sent = true;
        controller.enqueue(bytes);
      }
    },
  });
}

function rangeOf(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.range;
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'fphd-download-test-'));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

describe('downloadFile', () => {
  it('resumes a dropped download from the bytes written, pinned to the first ETag', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const range = rangeOf(init);
      if (!range) return response(dropsAfter(contents.slice(0, 8)), { headers: { etag: '"v1"' } });
      const from = Number(/^bytes=(\d+)-$/.exec(range)?.[1]);
      return response(contents.slice(from), {
        status: 206,
        headers: { 'content-range': `bytes ${from}-${contents.length - 1}/${contents.length}` },
      });
    });
    vi.stubGlobal('fetch', fetch);
    const resumes: DownloadResume[] = [];
    const path = join(directory, 'package.tar');

    await downloadFile(url, path, 'Package', {
      retryDelayMs: 0,
      onResume: (resume) => resumes.push(resume),
    });

    expect(await readFile(path)).toEqual(Buffer.from(contents));
    expect(resumes).toMatchObject([{ attempt: 1, bytes: 8 }]);
    expect(fetch.mock.calls[1]?.[1]).toEqual({
      headers: { range: 'bytes=8-', 'if-match': '"v1"' },
    });
  });

  it('starts again from the first byte when the server ignores the range', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? response(dropsAfter(contents.slice(0, 8)), { headers: { etag: '"v1"' } })
          : response(contents, { headers: { etag: '"v1"' } });
      }),
    );
    const path = join(directory, 'package.tar');

    await downloadFile(url, path, 'Package', { retryDelayMs: 0 });

    expect(await readFile(path)).toEqual(Buffer.from(contents));
  });

  it('refuses to resume once the object has been replaced', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? response(dropsAfter(contents.slice(0, 8)), { headers: { etag: '"v1"' } })
          : response(null, { status: 412 });
      }),
    );

    await expect(
      downloadFile(url, join(directory, 'package.tar'), 'Package', { retryDelayMs: 0 }),
    ).rejects.toThrow('Package changed during download');
  });

  it('does not retry an HTTP error', async () => {
    const fetch = vi.fn(async () => response(null, { status: 403 }));
    vi.stubGlobal('fetch', fetch);

    await expect(
      downloadFile(url, join(directory, 'package.tar'), 'Package', { retryDelayMs: 0 }),
    ).rejects.toThrow('Package download returned HTTP 403');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last attempt drops', async () => {
    const fetch = vi.fn(async () =>
      response(dropsAfter(contents.slice(0, 1)), { headers: { etag: '"v1"' } }),
    );
    vi.stubGlobal('fetch', fetch);

    await expect(
      downloadFile(url, join(directory, 'package.tar'), 'Package', {
        attempts: 3,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow('terminated');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('refuses a plain HTTP URL before requesting it', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(
      downloadFile('http://example.test/a', join(directory, 'a'), 'Package'),
    ).rejects.toThrow('Package URL must use HTTPS');
    expect(fetch).not.toHaveBeenCalled();
  });
});
