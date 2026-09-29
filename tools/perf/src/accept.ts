import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Copies the numbers a CI run measured into tools/perf/baseline.json, for a change whose extra
 * work is intended:
 *
 *   pnpm perf:accept <run-id>
 */
const runId = process.argv[2];
if (runId === undefined || !/^\d+$/.test(runId)) {
  console.error('usage: pnpm perf:accept <run-id>  (the number in the CI run’s URL)');
  process.exit(1);
}

const baselinePath = path.resolve(import.meta.dirname, '..', 'baseline.json');
const dir = await mkdtemp(path.join(tmpdir(), 'fphd-perf-'));
try {
  execFileSync('gh', ['run', 'download', runId, '--name', 'perf-baseline', '--dir', dir], {
    stdio: 'inherit',
  });
  await copyFile(path.join(dir, 'baseline.json'), baselinePath);
  console.log(`Updated tools/perf/baseline.json from run ${runId}. Review the diff and commit it.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
