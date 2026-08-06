import { migrateToLatest, rebuildReadModels, type SqlClient } from '@fphd/db';

import { bootstrap, seed } from './db-commands.js';
import type { Config } from './load-config.js';

export interface Command {
  description: string;
  run(sql: SqlClient, config: Config): Promise<void>;
}

/**
 * Keyed by the whole command line rather than nested by group, so the registry is also the
 * list of what can be run — `db` is the first group of several this image is expected to
 * grow, and a flat map keeps adding one to a single place.
 */
export const commands: Record<string, Command> = {
  'db bootstrap': {
    description: 'Create the per-API login roles, or reset their passwords if they exist',
    run: bootstrap,
  },
  'db migrate': {
    description: 'Apply every pending migration',
    run: (sql) => migrateToLatest(sql),
  },
  'db seed': {
    description: 'Replace all data with the committed seed, then rebuild the read models',
    run: seed,
  },
  'db rebuild-read-models': {
    description: 'Rebuild the read models from the canonical tables',
    run: (sql) => rebuildReadModels(sql),
  },
};

export class UsageError extends Error {}

export function usage(): string {
  const width = Math.max(...Object.keys(commands).map((name) => name.length));
  const lines = Object.entries(commands).map(
    ([name, { description }]) => `  ${name.padEnd(width)}  ${description}`,
  );

  return ['Usage: operations <command>', '', 'Commands:', ...lines].join('\n');
}

export function resolveCommand(argv: readonly string[]): Command {
  const requested = argv.join(' ');
  const command = commands[requested];

  if (command === undefined) {
    throw new UsageError(requested === '' ? 'No command given' : `Unknown command: ${requested}`);
  }

  return command;
}
