import {
  API_ROLES,
  analyzeReadModels,
  assertCoreDataPresent,
  assertMigratable,
  assertResetAllowed,
  assertSeedingAllowed,
  bootstrapRoles,
  compareMigrations,
  type DatabaseRole,
  importCoreData as importCoreDataFromFiles,
  READ_MODEL_TABLES,
  readAppliedMigrations,
  readLocalMigrations,
  rebuildReadModels as rebuildReadModelsFromCanonical,
  rebuildReadModelTables,
  resetDatabase,
  seedDummyTables,
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
 * Loads the required starting data — the content every environment needs before it can
 * serve anything, as opposed to the dummy seed. Idempotent and ungated: preview and
 * production run this too.
 */
export async function importCoreData({ sql, logger }: CommandContext): Promise<void> {
  const { summary, orphaned } = await importCoreDataFromFiles(sql);
  logger.info({ ...summary }, 'Topics imported');
  for (const topic of orphaned) {
    logger.warn(
      { id: topic.id, slug: topic.slug },
      'Topic in the database but absent from the file; left in place',
    );
  }
}

/**
 * Seeds, imports the dummy indicator relationships and rebuilds the read models in one
 * command and one transaction, unlike the local multi-script history: a job runs one
 * command, and a seeded database whose read models are still empty serves an empty site.
 * One commit for all of it, so readers never see a partial state mid-run and any failure
 * rolls the whole seed back.
 *
 * Core data must already be imported — the relationships reference topics by id, and dummy
 * data may depend on core data, never the reverse.
 */
export async function seedDummyData({ sql, config, logger }: CommandContext): Promise<void> {
  assertSeedingAllowed(config.appEnv);
  await assertCoreDataPresent(sql);

  const summary = await sql.begin(async (tx) => {
    const applied = await seedDummyTables(tx);
    await rebuildReadModelTables(tx);
    return applied;
  });
  await analyzeReadModels(sql);

  const { unknownTopics, unknownIndicators, ...counts } = summary;
  logger.info(counts, 'Indicator relationships imported');
  if (unknownTopics.length > 0) {
    logger.warn({ topics: unknownTopics }, 'Topic ids in the file not in this database; skipped');
  }
  if (unknownIndicators.length > 0) {
    logger.warn(
      { indicators: unknownIndicators },
      'Indicators in the file not in this database; skipped',
    );
  }
}

/** Reports each table's row count after the rebuild — an empty read model serves an empty site. */
export async function rebuildReadModels({ sql, logger }: CommandContext): Promise<void> {
  await rebuildReadModelsFromCanonical(sql);
  for (const table of READ_MODEL_TABLES) {
    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM ${sql(table)}
    `;
    logger.info({ table, rows: row?.count ?? 0 }, 'Read model rebuilt');
  }
}

/**
 * The gate is the only guard: a deployed job has no interactive confirmation, so refusing
 * outside dev-class environments is what stands between this and a production database.
 */
export async function reset({ sql, config }: CommandContext): Promise<void> {
  assertResetAllowed(config.appEnv);
  await resetDatabase(sql);
}

/**
 * One structured line per migration rather than a table, because a job's stdout is the log
 * stream and a deployed environment reads it as JSON. It reports first and fails after, so
 * the detail is on the way out before the error that gates a pipeline on it.
 */
export async function status({ sql, logger }: CommandContext): Promise<void> {
  const reports = compareMigrations(readLocalMigrations(), await readAppliedMigrations(sql));

  for (const report of reports) {
    logger.info({ migration: report.tag, state: report.state }, 'Migration');
  }

  const counts = reports.reduce<Record<string, number>>((totals, report) => {
    totals[report.state] = (totals[report.state] ?? 0) + 1;
    return totals;
  }, {});
  logger.info({ total: reports.length, ...counts }, 'Migration status');

  assertMigratable(reports);
}
