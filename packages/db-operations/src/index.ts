/**
 * Everything only the operations CLI and the test harness do to a database: bootstrap,
 * migrate, import, seed, reset and rebuild. A package of its own so the API images ship
 * none of it, nor the migrations and seed data it reads.
 */
export { API_ROLES, bootstrapRoles, type DatabaseRole } from './bootstrap.ts';
export { assertCoreDataPresent, importCoreData } from './core-data.ts';
export type {
  IndicatorTopicFile,
  IndicatorTopicImportSummary,
} from './indicator-topic-import.ts';
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
} from './migration-status.ts';
export { migrateToLatest } from './migrations.ts';
export {
  analyzeReadModels,
  READ_MODEL_TABLES,
  rebuildReadModels,
  rebuildReadModelTables,
} from './read-models.ts';
export { resetDatabase } from './reset.ts';
export {
  assertResetAllowed,
  assertSeedingAllowed,
  readCsvHeader,
  SEED_TABLES,
  type SeedSummary,
  seedDummyTables,
  seedPublishedTables,
} from './seeding.ts';
