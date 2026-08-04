import { execFileSync } from 'node:child_process';
import { readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

import { findInternalReferences } from './internal.js';
import { collectRouteFiles } from './routes.js';
import { extractImportSpecifiers } from './specifiers.js';
import { collectDependencyClosure, readWorkspacePackages } from './workspace.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

/** Every reference to a public app — pnpm filter, dist path, log line — derives from these. */
type PublicApp = { pkg: string; dir: string };

const PUBLIC_WEB: PublicApp = { pkg: '@fphd/public-web', dir: 'apps/public-web' };
const PUBLIC_API: PublicApp = { pkg: '@fphd/public-api', dir: 'apps/public-api' };
const PUBLIC_APPS = [PUBLIC_WEB, PUBLIC_API];

type Violation = {
  check: string;
  detail: string;
  references: string[];
};

/** Cheapest check first, so the common failure is reported without waiting for a build. */
async function main(): Promise<void> {
  const violations: Violation[] = [
    ...(await checkDependencyClosures()),
    ...checkWebRouteTable(),
    ...(await checkApiOutput()),
    ...(await checkWebBundle()),
  ];

  if (violations.length === 0) {
    console.log('\nNo internal code found in the public artefacts.');
    return;
  }

  console.error('\nInternal code found in the public artefacts:\n');
  for (const violation of violations) {
    console.error(`  ${violation.check}: ${violation.detail}`);
    for (const reference of violation.references) {
      console.error(`    - ${reference}`);
    }
  }
  process.exitCode = 1;
}

async function checkDependencyClosures(): Promise<Violation[]> {
  console.log('Checking the public apps’ workspace dependency closures…');
  const packages = await readWorkspacePackages(repoRoot);

  return PUBLIC_APPS.flatMap(({ pkg }) => {
    const references = findInternalReferences(collectDependencyClosure(pkg, packages));
    return references.length === 0
      ? []
      : [{ check: 'dependency closure', detail: pkg, references }];
  });
}

/**
 * React Router declares route modules as path strings, not imports, so a route pointing at an
 * internal package is invisible to an import linter. The route table names those paths directly,
 * which catches the reference without waiting for a build — and reports it as the path the author
 * wrote rather than as a bundle chunk.
 */
function checkWebRouteTable(): Violation[] {
  console.log(`Checking ${PUBLIC_WEB.pkg}’s route table…`);
  const output = capture('pnpm', [
    '--filter',
    PUBLIC_WEB.pkg,
    'exec',
    'react-router',
    'routes',
    '--json',
  ]);

  const files = collectRouteFiles(output);
  if (files.length === 0) {
    throw new Error(`No route modules were found in the route table:\n${output}`);
  }

  const references = findInternalReferences(files);
  return references.length === 0
    ? []
    : [{ check: 'public-web route table', detail: 'src/routes.ts', references }];
}

async function checkApiOutput(): Promise<Violation[]> {
  console.log(`Building ${PUBLIC_API.pkg}…`);
  run('pnpm', ['--filter', `${PUBLIC_API.pkg}...`, 'run', 'build']);

  const dist = path.join(repoRoot, PUBLIC_API.dir, 'dist');
  const files = await findFiles(dist, '.js');
  if (files.length === 0) {
    throw new Error(`No JavaScript was emitted to ${dist}; the output cannot be inspected.`);
  }

  const violations: Violation[] = [];
  for (const file of files) {
    const specifiers = extractImportSpecifiers(await readFile(file, 'utf8'));
    const references = findInternalReferences(specifiers);
    if (references.length > 0) {
      violations.push({
        check: 'public-api output',
        detail: path.relative(repoRoot, file),
        references,
      });
    }
  }
  return violations;
}

/**
 * The bundle is minified, so module identity survives only in the sourcemaps. `hidden` emits them
 * without the `sourceMappingURL` comment that would otherwise point at them, which is what lets
 * this read the module graph out of the real build and then delete the maps: what remains in
 * `dist/` is byte-identical to a plain `react-router build`.
 */
async function checkWebBundle(): Promise<Violation[]> {
  console.log(`Building ${PUBLIC_WEB.pkg} and its dependencies, with sourcemaps…`);
  run('pnpm', ['--filter', `${PUBLIC_WEB.pkg}^...`, 'run', 'build']);
  run('pnpm', [
    '--filter',
    PUBLIC_WEB.pkg,
    'exec',
    'react-router',
    'build',
    '--sourcemapClient',
    'hidden',
    '--sourcemapServer',
    'hidden',
  ]);

  const dist = path.join(repoRoot, PUBLIC_WEB.dir, 'dist');
  const maps = await findFiles(dist, '.map');
  try {
    if (maps.length === 0) {
      throw new Error(`No sourcemaps were emitted to ${dist}; the bundle cannot be inspected.`);
    }

    const violations: Violation[] = [];
    for (const map of maps) {
      const { sources } = JSON.parse(await readFile(map, 'utf8')) as { sources?: unknown };
      const references = findInternalReferences(
        (Array.isArray(sources) ? sources : []).filter((source) => typeof source === 'string'),
      );
      if (references.length > 0) {
        violations.push({
          check: 'public-web bundle',
          detail: path.relative(dist, map),
          references,
        });
      }
    }
    return violations;
  } finally {
    await Promise.all(maps.map((map) => unlink(map)));
  }
}

async function findFiles(dir: string, extension: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * A build that fails takes its own diagnostics to stderr, so the only thing left to add is which
 * step gave up — without a Node stack trace, which in a CI log reads as this tool crashing rather
 * than as the gate doing its job.
 */
function run(command: string, args: string[]): void {
  try {
    execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  } catch {
    console.error(`\n${[command, ...args].join(' ')} failed; the artefacts cannot be inspected.`);
    process.exit(1);
  }
}

/** As `run`, but returns stdout. Anything the command reports goes straight to this process's stderr. */
function capture(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch {
    console.error(`\n${[command, ...args].join(' ')} failed; the artefacts cannot be inspected.`);
    process.exit(1);
  }
}

await main();
