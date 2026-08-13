import {
  API_ROLES,
  assertMigratable,
  assertSeedingAllowed,
  bootstrapRoles,
  compareMigrations,
  type DatabaseRole,
  readAppliedMigrations,
  readLocalMigrations,
  rebuildReadModels,
  seedDatabase,
} from '@fphd/db';

import type { CommandContext } from './commands.js';
import type { Config } from './load-config.js';

/**
 * The role names are fixed — the APIs connect as `public_api` and `internal_api`, and only
 * the passwords are injected — so this maps the two optional config values onto them. It
 * refuses rather than bootstrapping half the pair and reporting success.
 */
export function rolesToBootstrap(roles: Config['roles']): DatabaseRole[] {
  const required = [
    {
      name: API_ROLES.publicApi,
      variable: 'PUBLIC_API_PASSWORD',
      password: roles.publicApiPassword,
    },
    {
      name: API_ROLES.internalApi,
      variable: 'INTERNAL_API_PASSWORD',
      password: roles.internalApiPassword,
    },
  ];

  const missing = required.filter((role) => role.password === undefined);
  if (missing.length > 0) {
    throw new Error(
      `db bootstrap needs ${missing.map((role) => role.variable).join(' and ')} in the environment`,
    );
  }

  return required.flatMap(({ name, password }) =>
    password === undefined ? [] : [{ name, password }],
  );
}

export async function bootstrap({ sql, config }: CommandContext): Promise<void> {
  await bootstrapRoles(sql, rolesToBootstrap(config.roles));
}

/**
 * Rebuilds the read models in the same command, unlike the local `db:seed`/
 * `db:rebuild-read-models` pair: a job runs one command, and a seeded database whose read
 * models are still empty serves an empty site.
 */
export async function seed({ sql, config }: CommandContext): Promise<void> {
  assertSeedingAllowed(config.appEnv);
  await seedDatabase(sql);
  await rebuildReadModels(sql);
}

/**
 * One structured line per migration rather than a table, because a job's stdout is the log
 * stream and a deployed environment reads it as JSON. It reports first and fails after, so
 * the detail is on the way out before the error that gates a pipeline on it.
 */
export async function status({ sql, logger }: CommandContext): Promise<void> {
  const reports = compareMigrations(readLocalMigrations(), await readAppliedMigrations(sql));

  for (const report of reports) {
    logger.info(
      {
        migration: report.tag,
        state: report.state,
        appliedAt: report.appliedAt === undefined ? undefined : new Date(report.appliedAt),
      },
      'Migration',
    );
  }

  const counts = reports.reduce<Record<string, number>>((totals, report) => {
    totals[report.state] = (totals[report.state] ?? 0) + 1;
    return totals;
  }, {});
  logger.info({ total: reports.length, ...counts }, 'Migration status');

  assertMigratable(reports);
}
