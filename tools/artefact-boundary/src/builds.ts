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
// Where one command ends and the next may begin: a newline, `;`, `&`, `|` or `(`.
const COMMAND_BOUNDARY = /[\n;&|(]/;
const LINE_CONTINUATION = /\\\n/g;
const COMMAND_PREFIX = /^(?:\w+=|sudo$|-)/;
const BUILD_SUBCOMMANDS = ['buildx', 'image', 'compose'];

// Only inside `${{ }}`: the word in a shell string or an echo is not a secret. YAML comments
// never get here — the parser drops them.
const EXPRESSION = /\$\{\{[\s\S]*?\}\}/g;
// The `secrets` context itself, whole: not `vars.secrets2`, not a `.secrets` property of
// another context.
const SECRET_REFERENCE = /(?<![\w.])secrets(?!\w)(?:\.[A-Za-z_][A-Za-z0-9_]*|\[[^\]]*\])?/g;

/**
 * The images are public, so anything `docker build` can see may end up in a layer anyone can
 * pull. Inspects each build step's `run`, `with` and `env`, and the `env` it inherits from the
 * job and the workflow.
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
  return typeof step.run === 'string' && runsAnImageBuild(step.run);
}

/**
 * `docker build`, or `docker {buildx,image,compose} build`, in command position — after any
 * `VAR=value`, `sudo` or `-flag` prefix. Tokenised rather than matched by one regular expression,
 * which CodeQL rightly flagged for backtracking; `docker build` in an echo or a string never
 * qualifies. A flag's separate value is indistinguishable from a command, so `sudo -u root
 * docker build` is missed — the Trivy scan on the built image is the backstop.
 */
function runsAnImageBuild(script: string): boolean {
  return script
    .replaceAll(LINE_CONTINUATION, ' ')
    .split(COMMAND_BOUNDARY)
    .some((command) => {
      const words = command.trim().split(/\s+/);
      const start = words.findIndex((word) => !COMMAND_PREFIX.test(word));
      const [first, second = '', third] = start === -1 ? [] : words.slice(start);
      if (first !== 'docker') {
        return false;
      }
      return second === 'build' || (BUILD_SUBCOMMANDS.includes(second) && third === 'build');
    });
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

/** Each distinct secret reference inside an expression, tagged with its route. */
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
