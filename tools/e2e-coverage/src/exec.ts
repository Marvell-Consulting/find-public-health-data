import { execFileSync } from 'node:child_process';

/** Runs a command and returns its stdout. Anything it reports goes straight to this process's stderr. */
export function capture(command: string, args: string[], cwd: string): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch {
    // The command's own diagnostics are already on stderr; a Node stack trace on top would read
    // as this tool crashing rather than as the gate doing its job.
    console.error(`\n${[command, ...args].join(' ')} failed; the routes cannot be inspected.`);
    process.exit(1);
  }
}
