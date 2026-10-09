import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { acceptRun, type Baseline, serialiseBaseline } from './budget.ts';

/**
 * Adopts the numbers a CI run measured into tools/perf/baseline.json, for a change whose extra
 * work is intended. Only routes over budget, new or gone are taken; `--all` takes every route:
 *
 *   pnpm perf:accept <run-id> [--all]
 */
function readArgs(): { runId: string; all: boolean } | undefined {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { all: { type: 'boolean', default: false } },
    });
    const [runId, ...rest] = positionals;
    if (runId === undefined || rest.length > 0 || !/^\d+$/.test(runId)) return undefined;
    return { runId, all: values.all };
  } catch {
    return undefined;
  }
}

const args = readArgs();
if (args === undefined) {
  console.error('usage: pnpm perf:accept <run-id> [--all]  (the number in the CI run’s URL)');
  process.exit(1);
}
const { runId, all } = args;

const output = (command: string, commandArgs: string[]) =>
  execFileSync(command, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

// The run's numbers are only comparable with the baseline it was checked against.
const { headSha, headBranch } = JSON.parse(
  output('gh', ['run', 'view', runId, '--json', 'headSha,headBranch']),
) as { headSha: string; headBranch: string };
const head = output('git', ['rev-parse', 'HEAD']).trim();
if (headSha !== head) {
  console.error(
    `Run ${runId} measured ${headBranch} at ${headSha.slice(0, 7)}, but HEAD is ${head.slice(0, 7)}. ` +
      'Check out that commit, or merge main, push and accept the new run, so the routes are compared with the baseline CI used.',
  );
  process.exit(1);
}

const baselinePath = path.resolve(import.meta.dirname, '..', 'baseline.json');
const dir = await mkdtemp(path.join(tmpdir(), 'fphd-perf-'));
try {
  execFileSync('gh', ['run', 'download', runId, '--name', 'perf-baseline', '--dir', dir], {
    stdio: 'inherit',
  });
  const run = JSON.parse(await readFile(path.join(dir, 'baseline.json'), 'utf8')) as Baseline;
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as Baseline;
  const { baseline: accepted, updated, added, removed } = acceptRun(run, baseline, { all });

  const changes = [
    ...updated.map((route) => `  updated  ${route}`),
    ...added.map((route) => `  added    ${route}`),
    ...removed.map((route) => `  removed  ${route}`),
  ];
  if (changes.length === 0) {
    console.log(
      all
        ? `Run ${runId} matches tools/perf/baseline.json; nothing changed.`
        : `No route in run ${runId} is over budget, new or gone; nothing changed. --all takes every route’s numbers; time limits are \`limitMs\` in tools/perf/src/routes.ts.`,
    );
  } else {
    await writeFile(baselinePath, serialiseBaseline(accepted));
    console.log(`Updated tools/perf/baseline.json from run ${runId}:\n${changes.join('\n')}`);
    console.log('Review the diff and commit it.');
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
