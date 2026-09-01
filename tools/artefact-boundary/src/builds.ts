import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

/** One image-build step and every secret reference that can reach it — none, when it is clean. */
export type ImageBuild = {
  file: string;
  job: string;
  step: string;
  references: string[];
};

type Step = {
  name?: unknown;
  uses?: unknown;
  run?: unknown;
  env?: unknown;
  with?: unknown;
};

type Job = { env?: unknown; steps?: unknown };

const WORKFLOW_EXTENSIONS = ['.yml', '.yaml'];

const IMAGE_BUILD_ACTION = /^docker\/build-push-action(?:@|$)/;
// In command position — the start of a line or after `;`, `&&`, `|` or `(` — with any
// `VAR=value` or `sudo` prefix, and with `\`-continued lines allowed between the words.
const IMAGE_BUILD_COMMAND =
  /(?:^|[;&|(])[ \t]*(?:(?:\w+=\S*|sudo)(?:\s|\\\n)+)*docker(?:\s|\\\n)+(?:(?:buildx|image|compose)(?:\s|\\\n)+)?build\b/m;

// Only inside an expression: the word in a shell string or an echo is not a secret reaching
// anything. YAML comments never get this far — the parser drops them.
const EXPRESSION = /\$\{\{[\s\S]*?\}\}/g;
const SECRET_REFERENCE = /\bsecrets(?:\.[A-Za-z_][A-Za-z0-9_]*|\[[^\]]*\])?/g;

/**
 * The images are public artefacts, so anything `docker build` can see may end up in a layer
 * anyone can pull. A repository secret gets there through the step's own `run`, `with` or `env`,
 * or through `env` inherited from the job or the workflow — every one of those is inspected.
 */
export async function findSecretsReachingBuilds(repoRoot: string): Promise<ImageBuild[]> {
  const dir = path.join(repoRoot, '.github', 'workflows');
  const files = (await readdir(dir))
    .filter((name) => WORKFLOW_EXTENSIONS.includes(path.extname(name)))
    .sort();

  const builds = (
    await Promise.all(
      files.map(async (name) => {
        const file = path.join(dir, name);
        return collectImageBuilds(await readFile(file, 'utf8'), path.relative(repoRoot, file));
      }),
    )
  ).flat();

  if (builds.length === 0) {
    throw new Error(`No workflow under ${dir} builds an image; nothing can be checked.`);
  }

  return builds.filter(({ references }) => references.length > 0);
}

/** Every image-build step in one workflow, each with the secret references that can reach it. */
export function collectImageBuilds(yaml: string, file: string): ImageBuild[] {
  const parsed: unknown = parse(yaml);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${file} is not a workflow; nothing can be checked.`);
  }

  const { env: workflowEnv, jobs } = parsed as { env?: unknown; jobs?: unknown };
  if (typeof jobs !== 'object' || jobs === null) {
    return [];
  }

  const workflowReferences = secretReferences(scalarsOf(workflowEnv), 'workflow env');

  return Object.entries(jobs as Record<string, Job>).flatMap(([job, definition]) => {
    if (typeof definition !== 'object' || definition === null || !Array.isArray(definition.steps)) {
      return [];
    }
    const jobReferences = secretReferences(scalarsOf(definition.env), 'job env');

    return (definition.steps as Step[]).flatMap((step, index) => {
      if (typeof step !== 'object' || step === null || !buildsAnImage(step)) {
        return [];
      }
      const references = [
        ...workflowReferences,
        ...jobReferences,
        ...secretReferences(scalarsOf(step.env), 'step env'),
        ...secretReferences(scalarsOf(step.with), 'step with'),
        ...secretReferences(typeof step.run === 'string' ? [step.run] : [], 'step run'),
      ];
      return [{ file, job, step: stepLabel(step, index), references }];
    });
  });
}

function buildsAnImage(step: Step): boolean {
  if (typeof step.uses === 'string' && IMAGE_BUILD_ACTION.test(step.uses)) {
    return true;
  }
  return typeof step.run === 'string' && IMAGE_BUILD_COMMAND.test(step.run);
}

function stepLabel(step: Step, index: number): string {
  return typeof step.name === 'string' ? `"${step.name}"` : `#${index + 1}`;
}

function scalarsOf(mapping: unknown): string[] {
  if (typeof mapping !== 'object' || mapping === null) {
    return [];
  }
  return Object.values(mapping).map((value) => String(value));
}

/** Each distinct `secrets.NAME` (or the whole `secrets` context) inside an expression, tagged with its route. */
function secretReferences(values: readonly string[], via: string): string[] {
  const found = new Set<string>();
  for (const value of values) {
    for (const [expression] of value.matchAll(EXPRESSION)) {
      for (const [reference] of expression.matchAll(SECRET_REFERENCE)) {
        found.add(`${reference} (${via})`);
      }
    }
  }
  return [...found].sort();
}
