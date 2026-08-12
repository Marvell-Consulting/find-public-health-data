import { createPostgresClient } from '@fphd/db';
import { createLogger } from '@fphd/logger';

import { resolveCommand, UsageError, usage } from './commands.js';
import * as config from './config.js';

const logger = createLogger({
  name: 'operations',
  level: config.log.level,
  pretty: config.log.pretty,
});

// A usage mistake is not the same failure as a command that ran and could not finish, and a
// job's exit code is often all an operator sees first.
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

async function main(argv: readonly string[]): Promise<number> {
  let command: ReturnType<typeof resolveCommand>;

  try {
    command = resolveCommand(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`${error.message}\n\n${usage()}`);
    return EXIT_USAGE;
  }

  const name = argv.join(' ');
  // `max: 1` because every command is a single sequential unit of work: a pool would open
  // connections this job never uses, against a server whose connection limit the running
  // apps are also drawing on.
  const sql = createPostgresClient(config.db, { max: 1, onnotice: () => {} });

  try {
    logger.info({ command: name, database: config.db.database }, 'Running command');
    await command.run({ sql, config, logger });
    logger.info({ command: name }, 'Command complete');
    return 0;
  } catch (error) {
    logger.error({ command: name, err: error }, 'Command failed');
    return EXIT_FAILURE;
  } finally {
    await sql.end();
  }
}

process.exitCode = await main(process.argv.slice(2));
