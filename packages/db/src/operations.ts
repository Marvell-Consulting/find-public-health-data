/**
 * Everything only the operations CLI and the test harness do to a database: bootstrap,
 * migrate, import, seed, reset and rebuild. Kept off the package's default export so the
 * deployed APIs cannot reach it by accident.
 */
export { API_ROLES, bootstrapRoles, type DatabaseRole } from './bootstrap.js';
export { assertCoreDataPresent, importCoreData } from './core-data.js';
export type {
  IndicatorTopicFile,
  IndicatorTopicImportSummary,
} from './indicator-topic-repository.js';
export {
  type AppliedMigration,
  assertMigratable,
  blockingMigrations,
  compareMigrations,
  type LocalMigration,
  type MigrationReport,
  type MigrationState,
  readAppliedMigrations,
  readLocalMigrations,
} from './migration-status.js';
export { migrateToLatest } from './migrations.js';
export {
  analyzeReadModels,
  READ_MODEL_TABLES,
  rebuildReadModels,
  rebuildReadModelTables,
} from './read-models.js';
export { resetDatabase } from './reset.js';
export { createOwnerClient, loadOwnerEnv } from './scripts/owner-client.js';
export {
  assertResetAllowed,
  assertSeedingAllowed,
  type DummySeedSummary,
  seedDummyTables,
} from './seeding.js';
