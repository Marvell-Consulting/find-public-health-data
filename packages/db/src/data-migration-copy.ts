import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import type postgres from 'postgres';

const COPY_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
// Matches the deployed operations job's outer execution limit.
const COPY_COMPLETION_TIMEOUT_MS = 6 * 60 * 60 * 1_000;

export interface DataMigrationProgress {
  table: string;
  phase: 'baseline' | 'upsert' | 'delete' | 'relationships';
  state: 'started' | 'progress' | 'complete';
  percent?: number;
}

export type DataMigrationProgressReporter = (progress: DataMigrationProgress) => void;

async function copyWithProgress(
  file: string,
  writable: Writable,
  label: string,
  reportPercent: (percent: number) => void,
): Promise<void> {
  const source = createReadStream(file);
  const totalBytes = (await stat(file)).size;
  let readBytes = 0;
  let lastReported = -5;
  source.on('data', (chunk: string | Buffer) => {
    readBytes += Buffer.byteLength(chunk);
    const percent = Math.min(100, Math.floor((readBytes * 100) / totalBytes));
    if (percent >= lastReported + 5) {
      lastReported = percent;
      reportPercent(percent);
    }
  });
  const decompressed = createGunzip();
  const abort = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  const stalled = new Promise<'stalled'>((resolve) => {
    const stop = () => resolve('stalled');
    timeout = setTimeout(stop, COPY_IDLE_TIMEOUT_MS).unref();
    decompressed.once('end', () => {
      clearTimeout(timeout);
      timeout = setTimeout(stop, COPY_COMPLETION_TIMEOUT_MS).unref();
    });
  });
  const progress = () => timeout?.refresh();
  decompressed.on('data', progress);
  const copying = pipeline(source, decompressed, writable, {
    end: true,
    signal: abort.signal,
  });
  try {
    if ((await Promise.race([copying.then(() => 'finished' as const), stalled])) === 'stalled') {
      abort.abort();
      await copying.catch(() => undefined);
      throw new Error(`${label} stopped making progress`);
    }
  } finally {
    clearTimeout(timeout);
    decompressed.off('data', progress);
  }
}

export function quoteIdentifiers(values: readonly string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(', ');
}

export async function copyInto(
  tx: postgres.TransactionSql,
  target: string,
  columns: readonly string[],
  file: string,
  label: string,
  progress: Omit<DataMigrationProgress, 'state' | 'percent'>,
  report: DataMigrationProgressReporter,
): Promise<void> {
  report({ ...progress, state: 'started' });
  const writable = await tx
    .unsafe(
      `COPY "${target}" (${quoteIdentifiers(columns)}) FROM STDIN WITH (FORMAT csv, HEADER true)`,
    )
    .writable();
  await copyWithProgress(file, writable, label, (percent) =>
    report({ ...progress, state: 'progress', percent }),
  );
  report({ ...progress, state: 'complete' });
}
