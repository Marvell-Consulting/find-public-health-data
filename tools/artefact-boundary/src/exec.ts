import { execFileSync } from 'node:child_process';

export function run(command: string, args: string[], cwd: string): void {
  try {
    execFileSync(command, args, { cwd, stdio: 'inherit' });
  } catch {
    giveUp(command, args);
  }
}

/** As `run`, but returns stdout. Anything the command reports goes straight to this process's stderr. */
export function capture(command: string, args: string[], cwd: string): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch {
    giveUp(command, args);
  }
}

/**
 * A command that fails takes its own diagnostics to stderr, so the only thing left to add is which
 * step gave up — without a Node stack trace, which in a CI log reads as this tool crashing rather
 * than as the gate doing its job.
 */
function giveUp(command: string, args: string[]): never {
  console.error(`\n${[command, ...args].join(' ')} failed; the artefacts cannot be inspected.`);
  process.exit(1);
}
