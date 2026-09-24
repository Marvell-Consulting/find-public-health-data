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
  SEED_TABLES,
  seedDummyTables,
  seedPublishedTables,
} from '@fphd/db/operations';

import type { CommandContext } from './commands.ts';
import type { Config } from './load-config.ts';
import { downloadPublishedSnapshot } from './published-snapshot.ts';

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
  const { topics, ciMethods } = await importCoreDataFromFiles(sql);
  logger.info({ ...topics.summary }, 'Topics imported');
  for (const topic of topics.orphaned) {
    logger.warn(
      { id: topic.id, slug: topic.slug },
      'Topic in the database but absent from the file; left in place',
    );
  }
  logger.info({ ...ciMethods.summary }, 'CI methods imported');
  for (const method of ciMethods.orphaned) {
    logger.warn(
      { id: method.id, name: method.name },
      'CI method in the database but absent from the file; left in place',
    );
  }
}

/**
 * Seeds, imports the dummy indicator relationships and rebuilds the read models in one
 * command and one transaction: a job runs one command, a seeded database whose read models
 * are still empty serves an empty site, and one commit means readers never see a partial
 * state mid-run and any failure rolls the whole seed back.
 *
 * Core data must already be imported — the relationships reference topics by id, and dummy
 * data may depend on core data, never the reverse.
 */
export async function seedDummyData({ sql, config, logger }: CommandContext): Promise<void> {
  assertSeedingAllowed(config.appEnv);
  await assertCoreDataPresent(sql);

  const { tables, relationships } = await sql.begin(async (tx) => {
    const seeded = await seedDummyTables(tx);
    await rebuildReadModelTables(tx);
    return seeded;
  });
  await analyzeReadModels(sql);

  for (const [table, rows] of Object.entries(tables)) {
    logger.info({ table, rows }, 'Dummy table seeded');
  }
  const { unknownTopics, unknownIndicators, ...counts } = relationships;
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

/** Replaces dev seed data with the approved-only published benchmark snapshot. */
export async function importPublishedSnapshot({
  sql,
  config,
  logger,
}: CommandContext): Promise<void> {
  assertSeedingAllowed(config.appEnv, 'import published snapshot');
  await assertCoreDataPresent(sql);
  const { url, sha256 } = config.publishedSnapshot;
  if (!url || !sha256) {
    throw new Error(
      'db import-published-snapshot needs PUBLISHED_SNAPSHOT_URL and PUBLISHED_SNAPSHOT_SHA256',
    );
  }

  const snapshot = await downloadPublishedSnapshot(url, sha256);
  try {
    const seeded = await sql.begin(async (tx) => {
      const result = await seedPublishedTables(tx, snapshot.directory);
      for (const table of SEED_TABLES) {
        if (result.tables[table] !== snapshot.manifest.tables[table]?.rows) {
          throw new Error(`Published snapshot row count failed for ${table}`);
        }
      }
      // Recheck the version status after COPY. The exporter only reads approved
      // indicators, but this makes the import itself fail closed if an archive is
      // ever mislabeled or replaced before the transaction commits.
      const [drafts] = await tx.unsafe(
        "SELECT count(*)::int AS count FROM indicator_version WHERE status IS DISTINCT FROM 'published'",
      );
      if (Number(drafts?.count) !== 0) {
        throw new Error('Published snapshot contains an unpublished indicator version');
      }
      // Matching row counts do not prove the versions are spread one per indicator.
      const [uneven] = await tx.unsafe(
        `SELECT count(*)::int AS count FROM indicator i
         WHERE (SELECT count(*) FROM indicator_version v
                WHERE v.indicator_id = i.id AND v.status = 'published') <> 1`,
      );
      if (Number(uneven?.count) !== 0) {
        throw new Error('Published snapshot does not hold one published version per indicator');
      }
      // The dummy seed's planner statistics would give the full-data
      // read-model rebuild a misleading plan. Analyze before those large queries.
      for (const table of SEED_TABLES) await tx.unsafe(`ANALYZE "${table}"`);
      await rebuildReadModelTables(tx);
      return result;
    });
    await analyzeReadModels(sql);
    logger.info(
      { tables: seeded.tables, topicLinks: seeded.relationships.links },
      'Published snapshot imported',
    );
  } finally {
    await snapshot.cleanup();
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
