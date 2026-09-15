import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { capture } from './exec.js';
import { collectRoutePaths } from './routes.js';
import { findSpecsWithoutScan, findStaleEntries, findUncoveredRoutes } from './specs.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const specsRoot = path.join(repoRoot, 'e2e', 'tests');

/** A web app and the Playwright project directory holding its specs. */
type WebApp = { pkg: string; specDir: string };

const WEB_APPS: WebApp[] = [
  { pkg: '@fphd/public-web', specDir: 'public' },
  { pkg: '@fphd/internal-web', specDir: 'internal' },
];

async function main(): Promise<void> {
  const problems: string[] = [];
  const declared: string[] = [];

  for (const app of WEB_APPS) {
    console.log(`Checking ${app.pkg}’s routes against e2e/tests/${app.specDir}…`);
    const routes = readRoutes(app);
    declared.push(...routes);
    const specs = await listSpecs(app.specDir);
    for (const { route, problem } of findUncoveredRoutes(routes, specs)) {
      problems.push(`${app.pkg} ${route} ${problem}`);
    }
  }

  for (const route of findStaleEntries(declared)) {
    problems.push(`tools/e2e-coverage/src/specs.ts lists ${route}, which neither app routes`);
  }

  console.log('Checking every spec scans for accessibility violations…');
  for (const app of WEB_APPS) {
    const specs = await Promise.all(
      (await listSpecs(app.specDir)).map(async (name) => ({
        name: `e2e/tests/${app.specDir}/${name}`,
        source: await readFile(path.join(specsRoot, app.specDir, name), 'utf8'),
      })),
    );
    for (const name of findSpecsWithoutScan(specs)) {
      problems.push(`${name} never calls expectNoAccessibilityViolations`);
    }
  }

  if (problems.length === 0) {
    console.log(
      '\nEvery page route has a spec, and every spec scans for accessibility violations.',
    );
    return;
  }

  console.error('\nThe e2e suite does not cover the routes:\n');
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  process.exitCode = 1;
}

function readRoutes(app: WebApp): string[] {
  const output = capture(
    'pnpm',
    ['--filter', app.pkg, 'exec', 'react-router', 'routes', '--json'],
    repoRoot,
  );
  const routes = collectRoutePaths(output);
  if (routes.length === 0) {
    throw new Error(`No routes were found in ${app.pkg}’s route table:\n${output}`);
  }
  return routes;
}

/** Spec files under one Playwright project directory, relative to it. */
async function listSpecs(specDir: string): Promise<string[]> {
  const dir = path.join(specsRoot, specDir);
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const specs = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort();
  if (specs.length === 0) {
    throw new Error(`No specs were found under ${dir}; nothing can be checked.`);
  }
  return specs;
}

await main();
