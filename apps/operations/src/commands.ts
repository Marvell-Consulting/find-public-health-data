import { migrateToLatest, rebuildReadModels, type SqlClient } from '@fphd/db';
import type { Logger } from '@fphd/logger';

import { bootstrap, seed, status } from './db-commands.js';
import type { Config } from './load-config.js';

/**
 * The capabilities a command may use, passed whole rather than as positional arguments, so
 * adding one does not change every command's signature.
 */
export interface CommandContext {
  sql: SqlClient;
  config: Config;
  logger: Logger;
}

export interface Command {
  description: string;
  run(context: CommandContext): Promise<void>;
}

/**
 * Keyed by the whole command line rather than nested by group, so the registry is also the
 * list of what can be run — `db` is the first group of several this image is expected to
 * grow, and a flat map keeps adding one to a single place.
 */
export const commands: Record<string, Command> = {
  'db bootstrap': {
    description: 'Create the schema owner group and the per-API login roles, resetting passwords',
    run: bootstrap,
  },
  'db migrate': {
    description: 'Apply every pending migration',
    run: ({ sql }) => migrateToLatest(sql),
  },
  'db status': {
    description: 'Report the state of every migration, and fail if one blocks migrating',
    run: status,
  },
  'db seed': {
    description: 'Replace all data with the committed seed, then rebuild the read models',
    run: seed,
  },
  'db rebuild-read-models': {
    description: 'Rebuild the read models from the canonical tables',
    run: ({ sql }) => rebuildReadModels(sql),
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
