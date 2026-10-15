import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { gzipSync } from 'node:zlib';

import type postgres from 'postgres';
import { afterEach, expect, it, vi } from 'vitest';

import { copyInto } from './data-migration-copy.ts';

afterEach(() => vi.useRealTimers());

it('aborts COPY when the database never acknowledges the completed input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fphd-copy-test-'));
  try {
    const file = join(directory, 'rows.csv.gz');
    await writeFile(file, gzipSync('id\n11111111-1111-7111-1111-111111111111\n'));
    let ready!: () => void;
    const received = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const writable = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
      final() {
        ready();
      },
    });
    const tx = {
      unsafe: () => ({ writable: async () => writable }),
    } as unknown as postgres.TransactionSql;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const copying = copyInto(
      tx,
      'indicator',
      ['id'],
      file,
      'COPY into indicator',
      { table: 'indicator', phase: 'baseline' },
      () => {},
    );
    const rejected = expect(copying).rejects.toThrow('COPY into indicator stopped making progress');
    await received;
    await vi.advanceTimersByTimeAsync(30 * 60 * 1_000);
    await rejected;
    expect(writable.destroyed).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
