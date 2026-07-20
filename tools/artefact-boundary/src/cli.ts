import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { findInternalReferences } from './internal.js';
import { extractImportSpecifiers } from './specifiers.js';
import { collectDependencyClosure, readWorkspacePackages } from './workspace.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

type Violation = {
  check: string;
  detail: string;
  references: string[];
};

async function main(): Promise<void> {
  const violations: Violation[] = [
    ...(await checkDependencyClosures()),
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

  return ['@fphd/public-web', '@fphd/public-api'].flatMap((app) => {
    const references = findInternalReferences(collectDependencyClosure(app, packages));
    return references.length === 0
      ? []
      : [{ check: 'dependency closure', detail: app, references }];
  });
}

async function checkApiOutput(): Promise<Violation[]> {
  console.log('Building @fphd/public-api…');
  run('pnpm', ['--filter', '@fphd/public-api...', 'run', 'build']);

  const dist = path.join(repoRoot, 'apps', 'public-api', 'dist');
  const violations: Violation[] = [];
  for (const file of await readJsFiles(dist)) {
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
 * Vite's production output is minified, so module identity survives only in the sourcemaps. This
 * builds a second time with them enabled rather than shipping them: the module graph is identical
 * either way, and `dist/` stays exactly what deploys.
 */
async function checkWebBundle(): Promise<Violation[]> {
  console.log('Building @fphd/public-web with sourcemaps…');
  run('pnpm', ['--filter', '@fphd/public-web^...', 'run', 'build']);

  const outDir = await mkdtemp(path.join(tmpdir(), 'fphd-artefact-boundary-'));
  try {
    run('pnpm', [
      '--filter',
      '@fphd/public-web',
      'exec',
      'vite',
      'build',
      '--sourcemap',
      '--outDir',
      outDir,
      '--emptyOutDir',
    ]);

    const maps = (await readdir(outDir, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.map'))
      .map((entry) => path.join(entry.parentPath, entry.name));

    if (maps.length === 0) {
      throw new Error(`No sourcemaps were emitted to ${outDir}; the bundle cannot be inspected.`);
    }

    const violations: Violation[] = [];
    for (const map of maps) {
      const { sources } = JSON.parse(await readFile(map, 'utf8')) as { sources?: unknown };
      const references = findInternalReferences(
        (Array.isArray(sources) ? sources : []).filter((source) => typeof source === 'string'),
      );
      if (references.length > 0) {
        violations.push({ check: 'public-web bundle', detail: path.basename(map), references });
      }
    }
    return violations;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

async function readJsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function run(command: string, args: string[]): void {
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
}

await main();
