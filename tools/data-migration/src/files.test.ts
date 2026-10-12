import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

import { writeGzipped } from './files.ts';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function* chunks(parts: Buffer[]) {
  yield* parts;
}

describe('writeGzipped', () => {
  it('writes every chunk in order when the gzip buffer fills and drains', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'write-gzipped-'));
    directories.push(directory);
    // Incompressible chunks well past the gzip high-water mark force the drain path.
    const parts = Array.from({ length: 64 }, () => randomBytes(256 * 1024));
    const path = join(directory, 'out.csv.gz');

    await writeGzipped(chunks(parts), path);

    expect(gunzipSync(await readFile(path)).equals(Buffer.concat(parts))).toBe(true);
  });

  it('writes an empty file for an empty source', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'write-gzipped-'));
    directories.push(directory);
    const path = join(directory, 'empty.csv.gz');

    await writeGzipped(chunks([]), path);

    expect(gunzipSync(await readFile(path)).length).toBe(0);
  });
});
