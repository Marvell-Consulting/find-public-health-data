import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { streamSeedCsv } from './seeding.ts';

const directories: string[] = [];

async function csvFile(content = 'id,name\n1,Test area\n'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'fphd-copy-test-'));
  directories.push(directory);
  const file = join(directory, 'area.csv.gz');
  await writeFile(file, gzipSync(content));
  return file;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('streamSeedCsv', () => {
  it('streams the decompressed CSV into COPY', async () => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    await streamSeedCsv(await csvFile(), writable, 'area', 100);

    expect(Buffer.concat(chunks).toString()).toBe('id,name\n1,Test area\n');
  });

  it('allows COPY completion to take longer than source streaming', async () => {
    const writable = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
      final(callback) {
        setTimeout(callback, 200);
      },
    });

    await streamSeedCsv(await csvFile(), writable, 'area', 100, 500);
  });

  it('aborts a COPY stalled before the source stream ends', async () => {
    const writable = new Writable({
      write() {
        // Simulate a database connection that stops accepting COPY chunks.
      },
    });

    await expect(
      streamSeedCsv(
        await csvFile(`id,name\n${'1,Test area\n'.repeat(100_000)}`),
        writable,
        'area',
        50,
      ),
    ).rejects.toThrow('COPY into "area" stopped making progress');
    expect(writable.destroyed).toBe(true);
  });
});
